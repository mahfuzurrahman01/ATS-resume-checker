import { describe, it, expect } from "vitest";
import { scanSchema, PROMPT_VERSION, buildScanUserInput } from "./scan-prompt";

const VALID_SCAN = {
  is_resume: true,
  rejection_reason: null,
  header: {
    name: "John Doe",
    title: "Senior Engineer",
    email: "john@example.com",
    phone: "555-123-4567",
    location: "Remote",
    links: [{ label: "LinkedIn", url: "https://linkedin.com/in/johndoe" }],
  },
  sections: {
    experience: [
      {
        company: "Acme",
        role: "Engineer",
        dates: "2020 - 2022",
        bullets: ["Built things.", "Shipped things."],
      },
    ],
    education: [
      { institution: "State University", credential: "B.S. CS", dates: "2016 - 2020" },
    ],
    skills: { technical: ["TypeScript"], soft: ["Communication"] },
    certifications: [],
  },
  content_findings: [
    {
      category: "impact",
      severity: "high",
      finding: "No metrics in bullets.",
      evidence: "Built things.",
      fix: "Add a number or outcome.",
    },
  ],
  bullet_rewrites: [
    {
      original: "Built things.",
      rewritten: "Built [X] that improved [Y] by [X%].",
      why: "Adds scope and impact.",
      needs_user_input: true,
    },
  ],
  summary: "Solid resume, needs quantified impact.",
};

const REJECTED_SCAN = {
  is_resume: false,
  rejection_reason: "This text is a legal contract, not a resume.",
  header: {
    name: null,
    title: null,
    email: null,
    phone: null,
    location: null,
    links: [],
  },
  sections: {
    experience: [],
    education: [],
    skills: { technical: [], soft: [] },
    certifications: [],
  },
  content_findings: [],
  bullet_rewrites: [],
  summary: "",
};

describe("scanSchema", () => {
  it("has a stable prompt version", () => {
    expect(PROMPT_VERSION).toBe("scan-v3");
  });

  it("parses a valid scan response", () => {
    const result = scanSchema.safeParse(VALID_SCAN);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_resume).toBe(true);
      expect(result.data.bullet_rewrites).toHaveLength(1);
    }
  });

  it("parses a valid not-a-resume rejection response", () => {
    const result = scanSchema.safeParse(REJECTED_SCAN);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_resume).toBe(false);
      expect(result.data.rejection_reason).toContain("legal contract");
    }
  });

  it("rejects a response that includes a score field type mismatch", () => {
    const malformed = { ...VALID_SCAN, is_resume: "yes" };
    const result = scanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects a response missing required fields", () => {
    const malformed = { is_resume: true };
    const result = scanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown severity enum value", () => {
    const malformed = {
      ...VALID_SCAN,
      content_findings: [
        { ...VALID_SCAN.content_findings[0], severity: "extreme" },
      ],
    };
    const result = scanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });
});

describe("buildScanUserInput", () => {
  it("includes a computed experience fact when dates are present", () => {
    const input = buildScanUserInput("Engineer, Acme Jan 2020 - Jan 2022", []);
    expect(input).toContain("CANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE");
    expect(input).toContain("do not calculate your own");
  });

  it("omits the experience fact when no dates can be parsed", () => {
    const input = buildScanUserInput("No dates in this text at all.", []);
    expect(input).not.toContain("CANDIDATE'S TOTAL PROFESSIONAL EXPERIENCE");
  });

  it("is deterministic for identical input", () => {
    const text = "Engineer, Acme Jan 2020 - Jan 2022";
    expect(buildScanUserInput(text, [])).toBe(buildScanUserInput(text, []));
  });
});
