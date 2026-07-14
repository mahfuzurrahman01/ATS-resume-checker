import { GoogleGenAI } from "@google/genai";

// Detailed reports are a much larger generation (parse preview + rewrites +
// JD match), so they get a longer budget than a basic scan.
const BASIC_TIMEOUT_MS = 60_000;
const DETAILED_TIMEOUT_MS = 110_000;

/** Rejects if the given promise does not settle within `ms`. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

/**
 * Extra instructions appended for a paid "detailed report". Adds the ATS
 * parse preview, bullet rewrites, and (when a JD is given) job-match analysis.
 */
function buildDetailedPrompt(jobDescription?: string): string {
  const jd = jobDescription?.trim();
  const jdBlock = jd
    ? `
        JOB DESCRIPTION MATCH (text WAS provided by the user):
        --- PROVIDED TEXT START ---
        ${jd.slice(0, 6000)}
        --- PROVIDED TEXT END ---

        FIRST validate this text. A real job description mentions a role/title,
        responsibilities, requirements, or qualifications. If the text is clearly
        NOT a job posting (e.g. source code, SQL, a resume, random notes, lorem
        ipsum, or gibberish), then set:
          "jd_invalid": true,
          "jd_invalid_message": "The text you provided doesn't look like a job description. Please paste a real job posting and try again."
        and DO NOT fabricate a "jd_match" object. Omit jd_match entirely.

        Otherwise (it IS a job description), set "jd_invalid": false and add:
        "jd_match": {
          "job_title": "the role/title from the job description, e.g. Senior Frontend Engineer",
          "match_score": 0-100 (how well this resume fits THIS job),
          "matched_keywords": ["keywords from the JD found in the resume"],
          "missing_keywords": ["important JD keywords missing from the resume"],
          "title_alignment": "how well the candidate's title/level matches the role",
          "summary": "2-3 sentence verdict on fit and the top gap to close"
        }`
    : `
        No job description was provided, so OMIT the "jd_match" field entirely.`;

  return `
        DETAILED REPORT MODE (paid). In ADDITION to everything above, include:

        1. "parse_preview": a plain-text rendering of the resume exactly as a
           simple ATS parser would extract it (linear, no columns/tables/graphics).
           This shows the user what the machine actually reads.

        2. "bullet_rewrites": an array of up to 8 objects that take the WEAKEST
           experience bullet points and rewrite them. Each item:
           { "original": "...", "improved": "action verb + quantified result",
             "reason": "why the rewrite is stronger for ATS and recruiters" }
           Only include bullets that genuinely need improvement.
        ${jdBlock}

        Return all of these inside the SAME top-level JSON object.`;
}

export interface ResumeData {
  document_type: string;
  is_resume?: boolean;
  message?: string;
  header?: {
    name: string;
    email: string;
    phone: string;
    location: string;
    linkedin?: string;
    website?: string;
  };
  sections?: {
    summary?: string;
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      description: string;
      achievements: string[];
    }>;
    education: Array<{
      degree: string;
      institution: string;
      year: string;
      gpa?: string;
    }>;
    skills: {
      technical: string[];
      soft: string[];
      languages?: string[];
    };
    certifications?: Array<{
      name: string;
      issuer: string;
      year: string;
    }>;
  };
  ats_analysis?: {
    score: number;
    issues: string[];
    recommendations: string[];
    keyword_matches: string[];
    missing_keywords: string[];
  };
  pro_suggestions?: {
    categories: Array<{
      category: string;
      priority: "Critical" | "High" | "Medium" | "Low";
      suggestions: string[];
      impact: string;
    }>;
    summary: {
      total_categories: number;
      total_suggestions: number;
      potential_score_increase: number;
    };
  };
  // ----- detailed-report fields (paid) -----
  /** Set when the provided "job description" is clearly not a job posting. */
  jd_invalid?: boolean;
  jd_invalid_message?: string;
  /** Job-description match analysis, present only when a JD is provided. */
  jd_match?: {
    job_title: string; // short role title from the JD, for labeling
    match_score: number; // 0-100 fit for the specific job
    matched_keywords: string[];
    missing_keywords: string[];
    title_alignment: string; // how well the resume title fits the role
    summary: string; // short verdict
  };
  /** Plain text an ATS is likely to extract from the resume. */
  parse_preview?: string;
  /** Rewritten experience bullets: weak -> action-verb + quantified. */
  bullet_rewrites?: Array<{
    original: string;
    improved: string;
    reason: string;
  }>;
}

export type AnalysisMode = "basic" | "detailed";

export interface AnalysisOptions {
  mode?: AnalysisMode;
  /** Optional job description to match the resume against (detailed mode). */
  jobDescription?: string;
}

export interface ATSAnalysisResult {
  success: boolean;
  data?: ResumeData;
  error?: string;
  raw_text?: string;
}

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // Server-only key. NEXT_PUBLIC_ prefix kept as a fallback for backward
    // compatibility with existing .env files, but GEMINI_API_KEY is preferred
    // so the key is never inlined into the client bundle.
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async processResumeWithGemini(
    base64Data: string,
    fileType: string,
    options: AnalysisOptions = {}
  ): Promise<ATSAnalysisResult> {
    try {
      const { mode = "basic", jobDescription } = options;
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth() + 1; // getMonth() returns 0-11

      const detailedSection =
        mode === "detailed" ? buildDetailedPrompt(jobDescription) : "";

      const prompt = `
        FIRST: Determine if this document is actually a resume or CV. Look for:
        - Personal contact information (name, email, phone)
        - Work experience or employment history
        - Education background
        - Skills or qualifications
        - Professional summary or objective
        
        If this is NOT a resume/CV (e.g., it's a letter, invoice, article, etc.), return:
        {
          "document_type": "not_resume",
          "is_resume": false,
          "message": "This document does not appear to be a resume or CV. Please upload a resume document for analysis."
        }

        If this IS a resume/CV, analyze it and extract information in the following structured format:

        RESUME ANALYSIS:
        Extract all sections and provide ATS compatibility analysis.

        Return the data in JSON format with this structure:
        {
          "document_type": "resume",
          "is_resume": true,
          "header": {
            "name": "Full Name",
            "email": "email@example.com",
            "phone": "phone number",
            "location": "city, state",
            "linkedin": "linkedin url if present",
            "website": "personal website if present"
          },
          "sections": {
            "summary": "professional summary if present",
            "experience": [
              {
                "title": "Job Title",
                "company": "Company Name",
                "duration": "Duration (e.g., 2020-2022)",
                "description": "Job description",
                "achievements": ["achievement 1", "achievement 2"]
              }
            ],
            "education": [
              {
                "degree": "Degree Name",
                "institution": "Institution Name",
                "year": "Graduation Year",
                "gpa": "GPA if mentioned"
              }
            ],
            "skills": {
              "technical": ["skill1", "skill2"],
              "soft": ["soft skill1", "soft skill2"],
              "languages": ["language1", "language2"]
            },
            "certifications": [
              {
                "name": "Certification Name",
                "issuer": "Issuing Organization",
                "year": "Year obtained"
              }
            ]
          },
          "ats_analysis": {
            "score": 85,
            "issues": ["issue1", "issue2"],
            "recommendations": ["recommendation1", "recommendation2"],
            "keyword_matches": ["keyword1", "keyword2"],
            "missing_keywords": ["missing1", "missing2"]
          },
          "pro_suggestions": {
            "categories": [
              {
                "category": "Header Optimization",
                "priority": "High",
                "suggestions": [
                  "Move contact information to the very top of the resume",
                  "Use a professional email format (firstname.lastname@email.com)",
                  "Include a professional LinkedIn URL",
                  "Add a location that matches job requirements"
                ],
                "impact": "Improves ATS parsing by 25%"
              },
              {
                "category": "Experience Section",
                "priority": "High",
                "suggestions": [
                  "Use action verbs at the beginning of each bullet point",
                  "Include quantifiable achievements with numbers and percentages",
                  "Add industry-specific keywords naturally",
                  "Keep bullet points to 1-2 lines maximum"
                ],
                "impact": "Increases keyword matching by 40%"
              },
              {
                "category": "Skills Section",
                "priority": "Medium",
                "suggestions": [
                  "Create separate sections for technical and soft skills",
                  "Include proficiency levels (Beginner, Intermediate, Expert)",
                  "Add emerging technologies relevant to your field",
                  "Use industry-standard skill names"
                ],
                "impact": "Boosts skill recognition by 30%"
              },
              {
                "category": "Education & Certifications",
                "priority": "Medium",
                "suggestions": [
                  "Add graduation dates in MM/YYYY format",
                  "Include relevant certifications with expiration dates",
                  "List education in reverse chronological order",
                  "Add GPA if above 3.5"
                ],
                "impact": "Enhances qualification matching by 20%"
              },
              {
                "category": "Formatting & Structure",
                "priority": "High",
                "suggestions": [
                  "Use standard fonts (Arial, Calibri, Times New Roman)",
                  "Remove graphics, tables, and complex formatting",
                  "Use simple bullet points instead of custom symbols",
                  "Ensure consistent date formatting throughout"
                ],
                "impact": "Improves parsing accuracy by 35%"
              },
              {
                "category": "Keyword Optimization",
                "priority": "Critical",
                "suggestions": [
                  "Add missing industry keywords identified in analysis",
                  "Include job title variations",
                  "Add technology stack keywords",
                  "Include soft skills that match job requirements"
                ],
                "impact": "Increases ATS score by 15-25 points"
              }
            ],
            "summary": {
              "total_categories": 6,
              "total_suggestions": 24,
              "potential_score_increase": 25
            }
          }
        }

        IMPORTANT DATE VALIDATION RULES:
        - Current date is ${currentYear}-${currentMonth
        .toString()
        .padStart(2, "0")}
        - "Present" or "Current" in dates is valid and should not be flagged as future
        - "Dec 2024 to present" is valid if we're in 2024
        - Only flag dates as future if they are clearly beyond the current date
        - Consider month abbreviations (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec)

        ATS Analysis Guidelines:
        - Score: 0-100 based on ATS compatibility
        - Issues: List specific problems found, but be careful with date validation
        - Recommendations: Provide actionable improvement suggestions
        - Keywords: Extract relevant technical and industry keywords
        - Missing keywords: Suggest important keywords that could be added

        Pro Suggestions Guidelines:
        - Only provide if document is confirmed to be a resume/CV
        - Analyze the resume and provide specific, actionable suggestions for each category
        - Prioritize suggestions based on their impact on ATS compatibility
        - Focus on practical, implementable changes
        - Consider industry best practices and current ATS requirements
${detailedSection}
      `;

      const contents = [
        { text: prompt },
        {
          inlineData: {
            mimeType:
              fileType === "application/pdf" ? "application/pdf" : "image/jpeg",
            data: base64Data,
          },
        },
      ];

      const response = await withTimeout(
        this.ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: contents,
          config: { responseMimeType: "application/json" },
        }),
        mode === "detailed" ? DETAILED_TIMEOUT_MS : BASIC_TIMEOUT_MS,
        "Resume analysis timed out. Please try again."
      );

      const responseText = response.text || "";
      let structuredData: ResumeData;
      try {
        // Try to parse JSON response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structuredData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No valid JSON found");
        }
      } catch {
        // Fallback parsing with default pro suggestions
        structuredData = {
          document_type: "resume",
          is_resume: true,
          header: {
            name: "Extracted from document",
            email: "",
            phone: "",
            location: "",
          },
          sections: {
            experience: [],
            education: [],
            skills: {
              technical: [],
              soft: [],
            },
          },
          ats_analysis: {
            score: 50,
            issues: ["Unable to parse structured data"],
            recommendations: ["Please check the document format"],
            keyword_matches: [],
            missing_keywords: [],
          },
          pro_suggestions: {
            categories: [
              {
                category: "Header Optimization",
                priority: "High",
                suggestions: [
                  "Move contact information to the very top of the resume",
                  "Use a professional email format",
                  "Include a professional LinkedIn URL",
                ],
                impact: "Improves ATS parsing by 25%",
              },
              {
                category: "Experience Section",
                priority: "High",
                suggestions: [
                  "Use action verbs at the beginning of each bullet point",
                  "Include quantifiable achievements",
                  "Add industry-specific keywords naturally",
                ],
                impact: "Increases keyword matching by 40%",
              },
            ],
            summary: {
              total_categories: 2,
              total_suggestions: 6,
              potential_score_increase: 15,
            },
          },
        };
      }

      return {
        success: true,
        data: structuredData,
        raw_text: responseText,
      };
    } catch (error) {
      // Log the raw provider error for debugging, but return a clean,
      // user-friendly message — never leak raw Gemini JSON to the client.
      console.error("Error processing resume:", error);
      return {
        success: false,
        error: friendlyGeminiError(error),
        raw_text: "",
      };
    }
  }
}

/** Maps raw provider/network errors to short, human-readable messages. */
export function friendlyGeminiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();

  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "The analysis took too long this time. Please try again.";
  }
  if (
    lower.includes("429") ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate limit")
  ) {
    const m =
      msg.match(/retry in ([0-9.]+)s/i) ||
      msg.match(/retryDelay[":\s]+"?(\d+)s/i);
    const secs = m ? Math.ceil(parseFloat(m[1])) : null;
    return `Our AI is very busy right now and we've hit a temporary usage limit. Please try again${
      secs ? ` in about ${secs} seconds` : " in a minute"
    }. You were not charged.`;
  }
  if (
    lower.includes("503") ||
    lower.includes("unavailable") ||
    lower.includes("overloaded")
  ) {
    return "The AI service is temporarily unavailable. Please try again in a moment. You were not charged.";
  }
  if (
    lower.includes("api key") ||
    lower.includes("permission") ||
    lower.includes("401") ||
    lower.includes("403")
  ) {
    return "The analysis service is temporarily unavailable. Please try again later.";
  }
  if (lower.includes("safety") || lower.includes("blocked")) {
    return "We couldn't analyze this document. Please try a different file.";
  }
  return "Something went wrong while analyzing your resume. Please try again.";
}
