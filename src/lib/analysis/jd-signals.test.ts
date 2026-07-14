import { describe, it, expect } from "vitest";
import { validateJobDescription } from "./jd-signals";

const REAL_JD = `
Senior Frontend Engineer — Acme Corp

We are looking for a Senior Frontend Engineer to join our platform team.
You will build and maintain our design system and customer-facing dashboard.

Requirements:
- 5+ years of experience with React and TypeScript
- Strong understanding of web performance and accessibility
- Experience mentoring junior engineers

Responsibilities:
- Own the frontend architecture for our core product
- Collaborate closely with design and backend teams
- Review pull requests and uphold code quality standards

This is a senior-level role reporting to the Head of Engineering. We offer
competitive pay, remote work, and a generous learning budget for every
engineer on the team who wants to grow into a lead role over time.
`.repeat(1); // already well over 100 words

describe("validateJobDescription", () => {
  it("accepts a real job description", () => {
    const result = validateJobDescription(REAL_JD);
    expect(result.ok).toBe(true);
    expect(result.wordCount).toBeGreaterThanOrEqual(100);
    expect(result.signalsFound.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects text under 100 words even with strong signals", () => {
    const short =
      "We are looking for a senior engineer. You will build things. Requirements: React.";
    const result = validateJobDescription(short);
    expect(result.ok).toBe(false);
    expect(result.wordCount).toBeLessThan(100);
  });

  it("rejects long text with fewer than 2 signals", () => {
    const longButGeneric = Array.from(
      { length: 120 },
      () => "word"
    ).join(" ");
    const result = validateJobDescription(longButGeneric);
    expect(result.ok).toBe(false);
    expect(result.signalsFound.length).toBeLessThan(2);
  });

  it("rejects resume-like text (long but no job-posting signals)", () => {
    const resumeLike = Array.from(
      { length: 150 },
      (_, i) => `Built feature ${i} using React and Node.`
    ).join(" ");
    const result = validateJobDescription(resumeLike);
    expect(result.ok).toBe(false);
  });

  it("is deterministic", () => {
    expect(validateJobDescription(REAL_JD)).toEqual(
      validateJobDescription(REAL_JD)
    );
  });
});
