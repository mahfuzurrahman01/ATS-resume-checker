import { z } from "zod";
import { computeExperience } from "../analysis/experience";

/**
 * MATCH prompt: judgment about how well a specific resume fits a specific job
 * description. Unlike SCAN, the AI does return a match_score here — keyword
 * overlap against a JD is genuinely a judgment call. The pipeline also
 * computes a deterministic keyword-overlap percentage in code and shows both.
 * Total years of experience is likewise computed in code (src/lib/analysis/
 * experience.ts) and given as a fact — inline date arithmetic is a known LLM
 * weak spot and gave different wrong answers across separate calls on the
 * same resume.
 */

export const PROMPT_VERSION = "match-v4";
export const MATCH_TIMEOUT_MS = 120_000;

export const MATCH_SYSTEM_PROMPT = `You are an expert technical recruiter and ATS specialist.

You will receive (a) the plain text of a candidate's resume and (b) the plain text of a
job description. Judge how well this specific candidate fits this specific role.

CRITICAL RULES:
1. Ground every claim in the actual text. Never invent skills the candidate does not have,
   and never invent requirements the job description does not state.
2. A "missing keyword" is ONLY a term that appears in the job description and does NOT
   appear in the resume. Nothing else qualifies.
3. Distinguish MUST-HAVES from NICE-TO-HAVES. A missing must-have is a real problem. A
   missing nice-to-have is noise. Do not present them as equally important.
4. Rewrites must use only facts present in the original resume. You may re-frame existing
   experience to speak to the job's language. You may NOT fabricate experience, metrics,
   or technologies. Use [X%] placeholders where a number is needed but not present.
5. Be honest about a bad fit. If the candidate is not qualified, say so plainly and
   explain what is missing. A false "82% match" that leads to a rejection is worse than
   an honest "41% — you're missing the core requirement."
6. OVERQUALIFIED IS NOT THE SAME AS NOT-A-FIT. If the candidate's total professional
   experience (given to you as a computed fact — never your own calculation) substantially
   exceeds what the job description asks for (e.g. the JD wants 0-2 years / "junior" /
   "entry-level" / "intern" and the candidate has 3+ years), and their core skills
   otherwise line up, use the verdict "overqualified" — NOT "not-a-fit". Being too senior
   for a role is a completely different situation from lacking the required skills, and it
   should never read as a rejection of the candidate's ability. Reserve "not-a-fit" for
   genuine skill, domain, or seniority-too-LOW mismatches.
7. FOUNDATIONAL SKILLS DESERVE THE BENEFIT OF THE DOUBT. Experienced candidates routinely
   omit baseline, ubiquitous tools from their resume (version control / Git, basic
   responsive CSS, standard debugging, etc.) because they're assumed at their level, not
   because they lack them. For a must-have that is common-sense-implied by the candidate's
   general experience level and stack (e.g. Git for any working software engineer; basic
   responsive layout for any frontend engineer) but is NOT explicitly named in the resume,
   mark it "partial" (not "missing") with evidence explaining the inference — e.g. "Not
   explicitly listed, but implied by 3+ years of shipped production frontend work." Reserve
   "missing" for requirements with no reasonable basis to assume the candidate has them
   (specialized, unusual, or domain-specific skills genuinely absent from the resume).

Return ONLY a JSON object matching this exact shape, no markdown fences, no preamble:

{
  "jd_valid": boolean,
  "rejection_reason": string | null,

  "job": {
    "title": string | null,
    "company": string | null,
    "seniority": "intern" | "junior" | "mid" | "senior" | "lead" | "unclear"
  },

  "match_score": number,
  "verdict": "strong" | "possible" | "stretch" | "overqualified" | "not-a-fit",
  "verdict_reason": string,

  "title_alignment": {
    "resume_title": string | null,
    "aligned": boolean,
    "note": string
  },

  "requirements": [{
    "requirement": string,
    "type": "must-have" | "nice-to-have",
    "status": "met" | "partial" | "missing",
    "evidence": string | null
  }],

  "keywords": {
    "matched": string[],
    "missing_critical": string[],
    "missing_optional": string[]
  },

  "bullet_rewrites": [{
    "original": string,
    "rewritten": string,
    "why": string,
    "needs_user_input": boolean
  }],

  "tailored_summary": string,

  "biggest_gap": string
}

Set jd_valid to false if the provided text is not a job description (it's a resume, code,
random text, or under 100 words of real job content). Set rejection_reason and leave the
rest empty. The user will not be charged.

Return at most 12 requirements and at most 6 bullet_rewrites, prioritized by importance.`;

const jobSchema = z.object({
  title: z.string().nullable(),
  company: z.string().nullable(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "unclear"]),
});

const titleAlignmentSchema = z.object({
  resume_title: z.string().nullable(),
  aligned: z.boolean(),
  note: z.string(),
});

const requirementSchema = z.object({
  requirement: z.string(),
  type: z.enum(["must-have", "nice-to-have"]),
  status: z.enum(["met", "partial", "missing"]),
  evidence: z.string().nullable(),
});

const keywordsSchema = z.object({
  matched: z.array(z.string()),
  missing_critical: z.array(z.string()),
  missing_optional: z.array(z.string()),
});

const bulletRewriteSchema = z.object({
  original: z.string(),
  rewritten: z.string(),
  why: z.string(),
  needs_user_input: z.boolean(),
});

export const matchSchema = z.object({
  jd_valid: z.boolean(),
  rejection_reason: z.string().nullable(),
  job: jobSchema,
  match_score: z.number(),
  verdict: z.enum(["strong", "possible", "stretch", "overqualified", "not-a-fit"]),
  verdict_reason: z.string(),
  title_alignment: titleAlignmentSchema,
  requirements: z.array(requirementSchema),
  keywords: keywordsSchema,
  bullet_rewrites: z.array(bulletRewriteSchema),
  tailored_summary: z.string(),
  biggest_gap: z.string(),
});

export type MatchResult = z.infer<typeof matchSchema>;

/**
 * Builds the user-turn input for the match prompt: the resume text and the
 * job description text, per the system prompt's stated contract ("You will
 * receive (a) the plain text of a candidate's resume and (b) the plain text
 * of a job description").
 */
export function buildMatchUserInput(resumeText: string, jdText: string): string {
  const experience = computeExperience(resumeText);
  const experienceNote = experience
    ? `\n\nCANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE (computed deterministically from the resume's dates — this is ground truth; if you mention total years of experience anywhere in your response, use exactly this figure and do not calculate your own): ${experience.label}.`
    : "";

  return `RESUME TEXT:\n"""\n${resumeText}\n"""\n\nJOB DESCRIPTION TEXT:\n"""\n${jdText}\n"""${experienceNote}`;
}
