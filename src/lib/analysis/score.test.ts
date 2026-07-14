import { describe, it, expect } from "vitest";
import type { CheckCategory, CheckResult, CheckSeverity } from "./checks";
import { computeScore } from "./score";

let seq = 0;
/** Builds a minimal CheckResult for scoring tests. */
function chk(
  category: CheckCategory,
  severity: CheckSeverity,
  passed: boolean,
  id?: string
): CheckResult {
  return {
    id: id ?? `chk-${seq++}`,
    category,
    severity,
    passed,
    title: "",
    detail: "",
    fix: "",
  };
}

/** One passing check per category — the baseline "perfect" resume. */
function allPass(): CheckResult[] {
  return [
    chk("parseability", "critical", true),
    chk("structure", "high", true),
    chk("contact", "critical", true),
    chk("content", "high", true),
    chk("formatting", "medium", true),
  ];
}

describe("computeScore", () => {
  it("gives 100 / excellent when everything passes", () => {
    const s = computeScore(allPass());
    expect(s.total).toBe(100);
    expect(s.band).toBe("excellent");
    expect(s.subscores.parseability).toEqual({ earned: 30, max: 30 });
    expect(s.subscores.content).toEqual({ earned: 25, max: 25 });
  });

  it("deducts 40% of a category max for a high-severity failure", () => {
    const s = computeScore([...allPass(), chk("content", "high", false)]);
    // content: 25 * (1 - 0.4) = 15
    expect(s.subscores.content.earned).toBe(15);
    expect(s.total).toBe(90);
    expect(s.band).toBe("excellent");
  });

  it("deducts 20% for medium and 10% for low", () => {
    const s = computeScore([
      ...allPass(),
      chk("formatting", "medium", false), // 10 * 0.8 = 8
      chk("structure", "low", false), // 20 * 0.9 = 18
    ]);
    expect(s.subscores.formatting.earned).toBe(8);
    expect(s.subscores.structure.earned).toBe(18);
  });

  it("drops a whole category to 0 on a critical failure", () => {
    const s = computeScore([...allPass(), chk("contact", "critical", false)]);
    expect(s.subscores.contact.earned).toBe(0);
    expect(s.total).toBe(85); // 30+20+0+25+10
  });

  it("floors a category at 0 when penalties exceed the max", () => {
    const s = computeScore([
      ...allPass(),
      chk("content", "high", false),
      chk("content", "high", false),
      chk("content", "high", false), // 3 x 0.4 = 1.2 -> floor 0
    ]);
    expect(s.subscores.content.earned).toBe(0);
  });

  it("rounds category scores to integers", () => {
    const s = computeScore([...allPass(), chk("content", "low", false)]);
    // 25 * 0.9 = 22.5 -> 23
    expect(s.subscores.content.earned).toBe(23);
    expect(Number.isInteger(s.total)).toBe(true);
  });

  it("HARD RULE: no-text-layer forces total 0 and zeroes every subscore", () => {
    const s = computeScore([
      chk("parseability", "critical", false, "no-text-layer"),
      chk("contact", "critical", true), // would otherwise earn points
      chk("content", "high", true),
      chk("structure", "high", true),
      chk("formatting", "medium", true),
    ]);
    expect(s.total).toBe(0);
    expect(s.band).toBe("critical");
    expect(s.subscores.contact.earned).toBe(0);
    expect(s.subscores.content.earned).toBe(0);
  });

  it("assigns good in the 65-84 band", () => {
    // 18 + 12 + 15 + 25 + 10 = 80
    const s = computeScore([
      ...allPass(),
      chk("parseability", "high", false), // 30*0.6 = 18
      chk("structure", "high", false), // 20*0.6 = 12
    ]);
    expect(s.total).toBe(80);
    expect(s.band).toBe("good");
  });

  it("assigns needs-work in the 40-64 band", () => {
    // two criticals -> 0 + 20 + 0 + 25 + 10 = 55
    const s = computeScore([
      ...allPass(),
      chk("parseability", "critical", false),
      chk("contact", "critical", false),
    ]);
    expect(s.total).toBe(55);
    expect(s.band).toBe("needs-work");
  });

  it("assigns critical in the 0-39 band", () => {
    // 0 + 12 + 0 + 15 + 6 = 33
    const s = computeScore([
      ...allPass(),
      chk("parseability", "critical", false), // 0
      chk("structure", "high", false), // 12
      chk("contact", "critical", false), // 0
      chk("content", "high", false), // 15
      chk("formatting", "high", false), // 10*0.6 = 6
    ]);
    expect(s.total).toBe(33);
    expect(s.band).toBe("critical");
  });

  it("is deterministic", () => {
    const checks = [...allPass(), chk("content", "medium", false)];
    expect(computeScore(checks)).toEqual(computeScore(checks));
  });
});
