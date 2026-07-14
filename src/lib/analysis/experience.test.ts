import { describe, it, expect } from "vitest";
import { computeExperience } from "./experience";

// Fixed "now" so tests are deterministic regardless of when they run.
const NOW = new Date(2026, 6, 13); // July 13, 2026 (month is 0-indexed)

describe("computeExperience", () => {
  it("returns null when no date range is found", () => {
    expect(computeExperience("No dates here at all.", NOW)).toBeNull();
  });

  it("computes a single closed range", () => {
    const r = computeExperience("Frontend Developer Nov 2022 - Jan 2023", NOW);
    expect(r?.totalMonths).toBe(3); // Nov, Dec, Jan inclusive
  });

  it("computes an open-ended 'Present' range against the fixed now", () => {
    const r = computeExperience("Engineer Dec 2024 - Present", NOW);
    // Dec 2024 through Jul 2026 inclusive = 20 months
    expect(r?.totalMonths).toBe(20);
  });

  it("sums back-to-back, non-overlapping roles", () => {
    const text = `
      Software Developer & Technical Writer — ESAP Dec 2024 - Present
      Frontend Developer, Zeigen Health Jan 2023 - Nov 2024
      Frontend Developer Intern, Calcite-X Nov 2022 - Jan 2023
    `;
    const r = computeExperience(text, NOW);
    // Nov2022-Jan2023 (3mo) + Jan2023-Nov2024 (23mo, months overlap by the
    // shared boundary month so they merge) + Dec2024-Present (20mo)
    expect(r).not.toBeNull();
    expect(r!.years).toBeGreaterThanOrEqual(3);
    expect(r!.totalMonths).toBeLessThan(48); // sanity: under 4 years
    expect(r!.totalMonths).toBeGreaterThan(36); // sanity: over 3 years
  });

  it("merges overlapping (concurrent) roles instead of double-counting", () => {
    const text = "Role A Jan 2020 - Dec 2021. Role B Jun 2020 - Jun 2022.";
    const r = computeExperience(text, NOW);
    // Combined span: Jan 2020 - Jun 2022 inclusive = 30 months, NOT
    // (24 + 25) = 49 months if double-counted.
    expect(r?.totalMonths).toBe(30);
  });

  it("is deterministic for identical input", () => {
    const text = "Engineer Jan 2023 - Nov 2024";
    expect(computeExperience(text, NOW)).toEqual(computeExperience(text, NOW));
  });

  it("produces a human-readable label", () => {
    const r = computeExperience("Role Jan 2020 - Jan 2021", NOW);
    expect(r?.label).toMatch(/year|month/);
  });

  describe("PDF-extraction column glue (regression)", () => {
    // Real PDF text extraction often flattens a two-column resume layout
    // (dates in one column, role title in the next) into one line with NO
    // separator between them — this is what unpdf actually returns for a
    // real resume, not neatly spaced text. A prior version of the regex
    // required a strict \b word boundary, which silently fails to match
    // "2023Frontend" or "PresentSoftware" (digit/letter directly followed by
    // a letter is not a \b boundary), causing computeExperience to return
    // null on real resumes and leave the AI to guess with no constraint.
    it("matches an end year glued directly to the next word", () => {
      const r = computeExperience("Jan 2023 - Nov 2024Frontend Developer", NOW);
      expect(r?.totalMonths).toBe(23);
    });

    it("matches 'Present' glued directly to the next word", () => {
      const r = computeExperience("Dec 2024 - PresentSoftware Developer", NOW);
      expect(r?.totalMonths).toBe(20);
    });

    it("does not false-positive on 'present' inside an unrelated word", () => {
      // "presently" must not be read as the word "present".
      const r = computeExperience("We are presently hiring for 2020 - 2021 roles.", NOW);
      // "2020 - 2021" has no month name, so it's filtered as likely
      // education/non-employment — the whole thing should be null, not a
      // bogus match anchored on "presently".
      expect(r).toBeNull();
    });

    it("matches the real resume's actual total experience, using unpdf's real (glued) text shape", () => {
      // This is verbatim the shape unpdf.extractText() produces for the
      // actual test resume — column text with zero separator before the
      // next word, exactly as reported in production.
      const realExtractedShape =
        "EDUCATION 2019 - 2021Bachelor of Science — Biochemistry\n" +
        "National University\nWORK\nEXPERIENCE\n" +
        "Nov 2022 - Jan 2023Frontend Developer Intern, Calcite-X\n" +
        "Jan 2023 - Nov 2024Frontend Developer, Zeigen Health\n" +
        "Dec 2024 - PresentSoftware Developer & Technical Writer — ESAP";
      const r = computeExperience(realExtractedShape, NOW);
      expect(r).not.toBeNull();
      // Ground truth: continuous work Nov 2022 through Jul 2026 (today) is
      // ~43-45 months (~3y7m-3y9m). The 2019-2021 education range must not
      // be swept in (no month name on it).
      expect(r!.totalMonths).toBeGreaterThanOrEqual(40);
      expect(r!.totalMonths).toBeLessThanOrEqual(48);
    });
  });
});
