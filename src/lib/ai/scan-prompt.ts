import { z } from "zod";
import type { CheckResult } from "@/lib/analysis/checks";
import { computeExperience } from "../analysis/experience";

/**
 * SCAN prompt: judgment about the quality of the writing and content of a
 * resume, by itself, with no job description. The AI never scores — scoring
 * is computed in src/lib/analysis/score.ts from deterministic checks. Total
 * years of experience is likewise computed in code (src/lib/analysis/
 * experience.ts) and given to the AI as a fact, not left for it to
 * calculate — inline date arithmetic is a known LLM weak spot and gave
 * different wrong answers across separate calls on the same resume.
 */

export const PROMPT_VERSION = "scan-v3";
export const SCAN_TIMEOUT_MS = 90_000;

export const SCAN_SYSTEM_PROMPT = `You are an expert resume reviewer and ATS (Applicant Tracking System) specialist.

You will receive the plain text extracted from a candidate's resume, plus a list of
mechanical checks that have ALREADY been computed deterministically by our system.

YOUR JOB is the part a machine cannot do: judge the QUALITY OF THE WRITING AND CONTENT.

CRITICAL RULES:
1. Do NOT output any score. Scoring is handled by our system. If you output a score it
   will be discarded.
2. Do NOT invent "missing keywords". Without a job description there is no such thing as
   a missing keyword. Never speculate about what a hypothetical employer might want.
3. Only describe what is ACTUALLY IN the resume text. Never infer, assume, or embellish.
   If the resume does not mention a technology, do not mention it.
4. Every rewrite you suggest must use only facts present in the original text. You may
   restructure, sharpen, and add strong verbs. You may NOT invent metrics, numbers,
   percentages, company names, or achievements. If a bullet lacks a metric, your rewrite
   should include a clearly-marked placeholder like [X%] and tell the user to fill it in.
   Fabricating a number on someone's resume could cost them a job. Never do it.
5. Be specific and blunt. "Improve your bullet points" is useless. "Your bullet 'Worked on
   the ERP system' names no technology, no scale, and no outcome" is useful.

Return ONLY a JSON object matching this exact shape, with no markdown fences and no
preamble:

{
  "is_resume": boolean,
  "rejection_reason": string | null,

  "header": {
    "name": string | null,
    "title": string | null,
    "email": string | null,
    "phone": string | null,
    "location": string | null,
    "links": [{ "label": string, "url": string }]
  },

  "sections": {
    "experience": [{
      "company": string,
      "role": string,
      "dates": string,
      "bullets": string[]
    }],
    "education": [{ "institution": string, "credential": string, "dates": string }],
    "skills": { "technical": string[], "soft": string[] },
    "certifications": string[]
  },

  "content_findings": [{
    "category": "impact" | "clarity" | "specificity" | "seniority" | "consistency",
    "severity": "high" | "medium" | "low",
    "finding": string,
    "evidence": string,
    "fix": string
  }],

  "bullet_rewrites": [{
    "original": string,
    "rewritten": string,
    "why": string,
    "needs_user_input": boolean
  }],

  "summary": string
}

Return at most 6 content_findings and at most 5 bullet_rewrites. Choose the ones with the
highest impact. Quality over quantity — a user will act on 3 great suggestions and ignore
15 mediocre ones.

Set is_resume to false if the text is clearly not a resume (an essay, a contract, code,
random text). In that case set rejection_reason and leave everything else empty.`;

const linkSchema = z.object({
  label: z.string(),
  url: z.string(),
});

const headerSchema = z.object({
  name: z.string().nullable(),
  title: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(linkSchema),
});

const experienceEntrySchema = z.object({
  company: z.string(),
  role: z.string(),
  dates: z.string(),
  bullets: z.array(z.string()),
});

const educationEntrySchema = z.object({
  institution: z.string(),
  credential: z.string(),
  dates: z.string(),
});

const sectionsSchema = z.object({
  experience: z.array(experienceEntrySchema),
  education: z.array(educationEntrySchema),
  skills: z.object({
    technical: z.array(z.string()),
    soft: z.array(z.string()),
  }),
  certifications: z.array(z.string()),
});

const contentFindingSchema = z.object({
  category: z.enum(["impact", "clarity", "specificity", "seniority", "consistency"]),
  severity: z.enum(["high", "medium", "low"]),
  finding: z.string(),
  evidence: z.string(),
  fix: z.string(),
});

const bulletRewriteSchema = z.object({
  original: z.string(),
  rewritten: z.string(),
  why: z.string(),
  needs_user_input: z.boolean(),
});

export const scanSchema = z.object({
  is_resume: z.boolean(),
  rejection_reason: z.string().nullable(),
  header: headerSchema,
  sections: sectionsSchema,
  content_findings: z.array(contentFindingSchema),
  bullet_rewrites: z.array(bulletRewriteSchema),
  summary: z.string(),
});

export type ScanResult = z.infer<typeof scanSchema>;

/**
 * Builds the user-turn input for the scan prompt: the extracted resume text
 * plus the deterministic checks that were already computed, per the system
 * prompt's stated contract ("plus a list of mechanical checks that have
 * ALREADY been computed deterministically by our system").
 */
export function buildScanUserInput(
  text: string,
  checks: CheckResult[]
): string {
  const summarized = checks.map(
    ({ id, category, severity, passed, title, detail, fix }) => ({
      id,
      category,
      severity,
      passed,
      title,
      detail,
      fix,
    })
  );
  const experience = computeExperience(text);
  const experienceNote = experience
    ? `\n\nCANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE (computed deterministically from the resume's dates — this is ground truth; if you mention total years of experience anywhere in your response, use exactly this figure and do not calculate your own): ${experience.label}.`
    : "";

  return `RESUME TEXT:\n"""\n${text}\n"""\n\nDETERMINISTIC CHECKS ALREADY COMPUTED:\n${JSON.stringify(
    summarized,
    null,
    2
  )}${experienceNote}`;
}
