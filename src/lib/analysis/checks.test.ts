import { describe, it, expect } from "vitest";
import type { PdfExtraction } from "../pdf/extract";
import { runChecks, pickTopIssue, type CheckResult } from "./checks";

/** Builds a PdfExtraction, deriving sensible defaults from the text. */
function extraction(
  over: Partial<PdfExtraction> & { text: string }
): PdfExtraction {
  const text = over.text;
  const pages = over.pages ?? [text];
  return {
    text,
    pages,
    pageCount: over.pageCount ?? pages.length,
    wordCount: over.wordCount ?? text.split(/\s+/).filter(Boolean).length,
    hasTextLayer:
      over.hasTextLayer ?? text.replace(/\s/g, "").length >= 100,
    charCountPerPage: over.charCountPerPage ?? pages.map((p) => p.length),
  };
}

function get(results: CheckResult[], id: string): CheckResult {
  const r = results.find((c) => c.id === id);
  if (!r) throw new Error(`check not found: ${id}`);
  return r;
}

const GOOD_RESUME = `John Doe
Senior Software Engineer
john.doe@example.com | (555) 123-4567 | linkedin.com/in/johndoe | San Francisco

SUMMARY
Senior software engineer with over eight years of experience building reliable
and scalable web applications and leading cross functional teams to deliver
measurable business results across fintech and enterprise software companies.

EXPERIENCE
Acme Corp - Senior Software Engineer
Jan 2020 - Mar 2022
• Led a team of 6 engineers to ship a payments platform serving 2 million users.
• Cut API latency by 40 percent by redesigning the caching layer and queries.
• Grew automated test coverage from 20 to 85 percent, reducing production issues.

Globex Inc - Software Engineer
Jun 2018 - Dec 2019
• Built a React dashboard adopted by 30 internal teams for real time reporting.
• Reduced build times by 55 percent by parallelizing the pipeline across workers.
• Mentored 4 junior engineers, three of whom were promoted within two years.

EDUCATION
State University - B.S. Computer Science, 2014 - 2018

SKILLS
TypeScript, React, Node.js, PostgreSQL, AWS, Docker, Kubernetes, GraphQL, Redis`;

describe("runChecks — a strong resume passes the relevant checks", () => {
  const results = runChecks(extraction({ text: GOOD_RESUME }));

  it("returns the full, stable set of checks", () => {
    expect(results).toHaveLength(19);
  });

  it.each([
    "no-text-layer",
    "too-few-words",
    "too-many-words",
    "excessive-pages",
    "missing-email",
    "missing-phone",
    "missing-linkedin",
    "contact-in-header-footer",
    "missing-section-experience",
    "missing-section-education",
    "missing-section-skills",
    "nonstandard-headings",
    "no-quantified-bullets",
    "weak-verb-openers",
    "first-person-pronouns",
    "dates-unparseable",
    "likely-multi-column",
    "special-chars-in-contact",
    "tables-detected",
  ])("passes %s", (id) => {
    expect(get(results, id).passed).toBe(true);
  });
});

describe("runChecks — each check fails on a targeted fixture", () => {
  it("no-text-layer", () => {
    const r = runChecks(
      extraction({ text: "", hasTextLayer: false, pages: [], pageCount: 0 })
    );
    expect(get(r, "no-text-layer").passed).toBe(false);
  });

  it("too-few-words", () => {
    const r = runChecks(extraction({ text: "Tiny resume.", wordCount: 12 }));
    expect(get(r, "too-few-words").passed).toBe(false);
  });

  it("too-many-words", () => {
    const r = runChecks(extraction({ text: "x", wordCount: 1300 }));
    expect(get(r, "too-many-words").passed).toBe(false);
  });

  it("excessive-pages", () => {
    const r = runChecks(extraction({ text: "x", pageCount: 3 }));
    expect(get(r, "excessive-pages").passed).toBe(false);
  });

  it("missing-email", () => {
    const r = runChecks(extraction({ text: "No contact here at all." }));
    expect(get(r, "missing-email").passed).toBe(false);
  });

  it("missing-phone", () => {
    const r = runChecks(extraction({ text: "email only a@b.com here." }));
    expect(get(r, "missing-phone").passed).toBe(false);
  });

  it("missing-linkedin", () => {
    const r = runChecks(extraction({ text: "a@b.com (555) 123-4567" }));
    expect(get(r, "missing-linkedin").passed).toBe(false);
  });

  it("contact-in-header-footer", () => {
    const footer = "Confidential Company Internal Document";
    const body = Array.from(
      { length: 8 },
      (_, i) => `Body line number ${i} describing responsibilities in detail here.`
    ).join("\n");
    const page1 =
      "John Doe john.doe@example.com (555) 123-4567\n" + body + "\n" + footer;
    const page2 = body + "\n" + footer;
    const r = runChecks(
      extraction({
        text: page1 + "\n\n" + page2,
        pages: [page1, page2],
        pageCount: 2,
      })
    );
    expect(get(r, "contact-in-header-footer").passed).toBe(false);
  });

  it("missing-section-experience", () => {
    const r = runChecks(extraction({ text: "Education and Skills only here." }));
    expect(get(r, "missing-section-experience").passed).toBe(false);
  });

  it("missing-section-skills", () => {
    const r = runChecks(
      extraction({ text: "Experience here. Education here. Nothing else." })
    );
    expect(get(r, "missing-section-skills").passed).toBe(false);
  });

  it("nonstandard-headings", () => {
    const r = runChecks(extraction({ text: "My Journey\nWhat I bring to teams." }));
    expect(get(r, "nonstandard-headings").passed).toBe(false);
  });

  it("no-quantified-bullets", () => {
    const text = [
      "• Led the team",
      "• Built features",
      "• Improved the process",
      "• Managed stakeholders",
    ].join("\n");
    const r = runChecks(extraction({ text }));
    expect(get(r, "no-quantified-bullets").passed).toBe(false);
  });

  it("weak-verb-openers", () => {
    const text = [
      "• Responsible for the team and daily operations across the org",
      "• Built a service that scaled to 10 thousand requests per second",
      "• Shipped three products in a single quarter with strong adoption",
    ].join("\n");
    const r = runChecks(extraction({ text }));
    const check = get(r, "weak-verb-openers");
    expect(check.passed).toBe(false);
    expect(check.evidence).toContain("Responsible for");
  });

  it("first-person-pronouns", () => {
    const text = [
      "• I led the team to deliver the release on time and on budget",
      "• Built a dashboard used by many teams for reporting and metrics",
      "• Shipped features that improved retention across the product line",
    ].join("\n");
    const r = runChecks(extraction({ text }));
    expect(get(r, "first-person-pronouns").passed).toBe(false);
  });

  it("dates-unparseable", () => {
    const r = runChecks(
      extraction({ text: "Worked at a company sometime around 2020 for a while." })
    );
    expect(get(r, "dates-unparseable").passed).toBe(false);
  });

  it("likely-multi-column", () => {
    const text = Array.from({ length: 25 }, () => "Short bit").join("\n");
    const r = runChecks(extraction({ text }));
    expect(get(r, "likely-multi-column").passed).toBe(false);
  });

  it("special-chars-in-contact", () => {
    const r = runChecks(
      extraction({ text: String.fromCharCode(0xe001) + " John Doe john@example.com" })
    );
    expect(get(r, "special-chars-in-contact").passed).toBe(false);
  });

  it("tables-detected", () => {
    const r = runChecks(
      extraction({ text: "Skills:    Java    Python    Go    Rust" })
    );
    expect(get(r, "tables-detected").passed).toBe(false);
  });
});

describe("runChecks is deterministic", () => {
  it("produces identical output for identical input", () => {
    const a = runChecks(extraction({ text: GOOD_RESUME }));
    const b = runChecks(extraction({ text: GOOD_RESUME }));
    expect(a).toEqual(b);
  });
});

describe("pickTopIssue", () => {
  it("returns null when everything passes", () => {
    expect(pickTopIssue(runChecks(extraction({ text: GOOD_RESUME })))).toBeNull();
  });

  it("picks the critical failure over a high failure", () => {
    const checks: CheckResult[] = [
      {
        id: "a",
        category: "content",
        severity: "high",
        passed: false,
        title: "High issue",
        detail: "",
        fix: "",
      },
      {
        id: "b",
        category: "parseability",
        severity: "critical",
        passed: false,
        title: "Critical issue",
        detail: "",
        fix: "",
      },
    ];
    expect(pickTopIssue(checks)?.id).toBe("b");
  });

  it("ignores passed checks even if listed first", () => {
    const checks: CheckResult[] = [
      {
        id: "a",
        category: "content",
        severity: "critical",
        passed: true,
        title: "",
        detail: "",
        fix: "",
      },
      {
        id: "b",
        category: "content",
        severity: "low",
        passed: false,
        title: "Low issue",
        detail: "",
        fix: "",
      },
    ];
    expect(pickTopIssue(checks)?.id).toBe("b");
  });

  it("keeps the first match on a severity tie", () => {
    const checks: CheckResult[] = [
      {
        id: "first",
        category: "content",
        severity: "high",
        passed: false,
        title: "",
        detail: "",
        fix: "",
      },
      {
        id: "second",
        category: "structure",
        severity: "high",
        passed: false,
        title: "",
        detail: "",
        fix: "",
      },
    ];
    expect(pickTopIssue(checks)?.id).toBe("first");
  });
});
