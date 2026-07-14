import { describe, it, expect } from "vitest";
import { keywordOverlapPercent } from "./keyword-overlap";

describe("keywordOverlapPercent", () => {
  it("returns 100 when every JD keyword appears in the resume", () => {
    const jd = "React TypeScript GraphQL";
    const resume = "React TypeScript GraphQL.";
    expect(keywordOverlapPercent(jd, resume)).toBe(100);
  });

  it("returns 0 when no JD keyword appears in the resume", () => {
    const jd = "Rust Kubernetes Kafka";
    const resume = "HTML CSS jQuery";
    expect(keywordOverlapPercent(jd, resume)).toBe(0);
  });

  it("returns a partial percentage for a partial match", () => {
    const jd = "React Python Postgres Kafka";
    const resume = "React Postgres";
    // jd tokens: react, python, postgres, kafka (4) — matched: react, postgres (2)
    expect(keywordOverlapPercent(jd, resume)).toBe(50);
  });

  it("returns 0 for an empty job description", () => {
    expect(keywordOverlapPercent("", "React TypeScript")).toBe(0);
  });

  it("ignores stopwords and short tokens", () => {
    const jd = "We are the that will do this and for you all so up out.";
    const resume = "Nothing relevant here at all.";
    expect(keywordOverlapPercent(jd, resume)).toBe(0);
  });

  it("is case-insensitive", () => {
    const jd = "REACT TYPESCRIPT";
    const resume = "react typescript";
    expect(keywordOverlapPercent(jd, resume)).toBe(100);
  });

  it("strips trailing sentence punctuation but keeps dotted tech tokens", () => {
    const jd = "React, Node.js, and PostgreSQL experience needed.";
    const resume = "Built with React, Node.js, and PostgreSQL.";
    // "postgresql." in a naive tokenizer would never match "postgresql" —
    // this guards against that regression.
    // jd tokens: react, node.js, postgresql, experience, needed (5)
    // matched: react, node.js, postgresql (3)
    expect(keywordOverlapPercent(jd, resume)).toBe(60);
  });

  it("is deterministic", () => {
    const jd = "React, Node.js, and PostgreSQL experience needed.";
    const resume = "Built with React, Node.js, and PostgreSQL.";
    expect(keywordOverlapPercent(jd, resume)).toBe(
      keywordOverlapPercent(jd, resume)
    );
  });
});
