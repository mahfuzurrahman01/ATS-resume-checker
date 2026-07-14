import { describe, it, expect } from "vitest";
import { matchSchema, PROMPT_VERSION, buildMatchUserInput } from "./match-prompt";

const VALID_MATCH = {
  jd_valid: true,
  rejection_reason: null,
  job: { title: "Senior Frontend Engineer", company: "Acme", seniority: "senior" },
  match_score: 72,
  verdict: "possible",
  verdict_reason: "Strong frontend background, missing some backend requirements.",
  title_alignment: {
    resume_title: "Software Engineer",
    aligned: true,
    note: "Titles are close enough.",
  },
  requirements: [
    {
      requirement: "5+ years React",
      type: "must-have",
      status: "met",
      evidence: "6 years React experience listed.",
    },
    {
      requirement: "GraphQL",
      type: "nice-to-have",
      status: "missing",
      evidence: null,
    },
  ],
  keywords: {
    matched: ["React", "TypeScript"],
    missing_critical: [],
    missing_optional: ["GraphQL"],
  },
  bullet_rewrites: [
    {
      original: "Built UI components.",
      rewritten: "Built reusable React UI components used across [X] products.",
      why: "Aligns with the JD's emphasis on component libraries.",
      needs_user_input: true,
    },
  ],
  tailored_summary: "Frontend engineer with strong React depth.",
  biggest_gap: "No demonstrated GraphQL experience.",
};

const REJECTED_MATCH = {
  jd_valid: false,
  rejection_reason: "This text is source code, not a job description.",
  job: { title: null, company: null, seniority: "unclear" },
  match_score: 0,
  verdict: "not-a-fit",
  verdict_reason: "",
  title_alignment: { resume_title: null, aligned: false, note: "" },
  requirements: [],
  keywords: { matched: [], missing_critical: [], missing_optional: [] },
  bullet_rewrites: [],
  tailored_summary: "",
  biggest_gap: "",
};

describe("matchSchema", () => {
  it("has a stable prompt version", () => {
    expect(PROMPT_VERSION).toBe("match-v4");
  });

  it("parses a valid match response", () => {
    const result = matchSchema.safeParse(VALID_MATCH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.match_score).toBe(72);
      expect(result.data.requirements).toHaveLength(2);
    }
  });

  it("parses a valid invalid-JD rejection response", () => {
    const result = matchSchema.safeParse(REJECTED_MATCH);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jd_valid).toBe(false);
      expect(result.data.rejection_reason).toContain("source code");
    }
  });

  it("rejects an unknown verdict enum value", () => {
    const malformed = { ...VALID_MATCH, verdict: "amazing" };
    const result = matchSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("accepts the 'overqualified' verdict, distinct from 'not-a-fit'", () => {
    const overqualified = { ...VALID_MATCH, verdict: "overqualified" };
    const result = matchSchema.safeParse(overqualified);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown requirement type enum value", () => {
    const malformed = {
      ...VALID_MATCH,
      requirements: [{ ...VALID_MATCH.requirements[0], type: "critical" }],
    };
    const result = matchSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects a response missing required fields", () => {
    const malformed = { jd_valid: true };
    const result = matchSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric match_score", () => {
    const malformed = { ...VALID_MATCH, match_score: "72" };
    const result = matchSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });
});

describe("buildMatchUserInput", () => {
  it("includes a computed experience fact when dates are present", () => {
    const input = buildMatchUserInput(
      "Engineer, Acme Jan 2020 - Jan 2022",
      "We need a senior engineer with 5+ years of experience."
    );
    expect(input).toContain("CANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE");
    expect(input).toContain("do not calculate your own");
  });

  it("omits the experience fact when no dates can be parsed", () => {
    const input = buildMatchUserInput("No dates here.", "Some job description.");
    expect(input).not.toContain("CANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE");
  });

  it("is deterministic for identical input", () => {
    const resume = "Engineer, Acme Jan 2020 - Jan 2022";
    const jd = "Job description text.";
    expect(buildMatchUserInput(resume, jd)).toBe(buildMatchUserInput(resume, jd));
  });
});
