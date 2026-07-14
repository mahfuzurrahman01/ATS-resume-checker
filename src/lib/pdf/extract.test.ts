import { describe, it, expect } from "vitest";
import jsPDF from "jspdf";
import { extractPdf } from "./extract";

/** Builds a small in-memory PDF; each inner array is one page's lines. */
function makePdf(pages: string[][]): Buffer {
  const doc = new jsPDF();
  pages.forEach((lines, i) => {
    if (i > 0) doc.addPage();
    doc.text(lines, 10, 20);
  });
  return Buffer.from(doc.output("arraybuffer"));
}

const RESUME_TEXT = [
  "John Doe — Senior Software Engineer",
  "Email: john.doe@example.com  Phone: 555-123-4567",
  "Experienced engineer building web applications with React, Node, and",
  "TypeScript across multiple teams, shipping reliable software at scale.",
];

describe("extractPdf", () => {
  it("extracts text and reports a text layer for a normal resume", async () => {
    const res = await extractPdf(makePdf([RESUME_TEXT]));

    expect(res.hasTextLayer).toBe(true);
    expect(res.text).toContain("John Doe");
    expect(res.text).toContain("TypeScript");
    expect(res.pageCount).toBe(1);
    expect(res.pages).toHaveLength(1);
    expect(res.charCountPerPage).toHaveLength(1);
    expect(res.wordCount).toBeGreaterThan(20);
  });

  it("counts multiple pages", async () => {
    const res = await extractPdf(makePdf([RESUME_TEXT, ["Page two content here"]]));

    expect(res.pageCount).toBe(2);
    expect(res.pages).toHaveLength(2);
    expect(res.charCountPerPage).toHaveLength(2);
    expect(res.text).toContain("Page two");
  });

  it("reports hasTextLayer: false when there is almost no text (image scan)", async () => {
    const res = await extractPdf(makePdf([["x"]]));

    expect(res.hasTextLayer).toBe(false);
    expect(res.wordCount).toBeLessThan(10);
  });

  it("never throws on malformed bytes; returns an empty result", async () => {
    const res = await extractPdf(Buffer.from([1, 2, 3, 4, 5]));

    expect(res.hasTextLayer).toBe(false);
    expect(res.text).toBe("");
    expect(res.pages).toEqual([]);
    expect(res.pageCount).toBe(0);
    expect(res.wordCount).toBe(0);
    expect(res.charCountPerPage).toEqual([]);
  });

  it("is deterministic for identical bytes", async () => {
    const pdf = makePdf([RESUME_TEXT]);
    const a = await extractPdf(pdf);
    const b = await extractPdf(pdf);

    expect(a.text).toBe(b.text);
    expect(a.wordCount).toBe(b.wordCount);
    expect(a.charCountPerPage).toEqual(b.charCountPerPage);
  });
});
