import { extractText } from "unpdf";

/**
 * Deterministic PDF → plain-text extraction.
 *
 * Pure and side-effect free: no AI, no network. Given the same PDF bytes it
 * always returns the same result. Feeds the AI (instead of a raw PDF blob) and
 * powers our deterministic ATS checks.
 */

/**
 * Below this many extracted characters we treat the PDF as an image scan with
 * no readable text layer — no ATS can read it.
 */
const MIN_TEXT_CHARS = 100;

export interface PdfExtraction {
  /** Full plain text, all pages joined. */
  text: string;
  /** Normalized text per page. */
  pages: string[];
  /** Number of pages in the document. */
  pageCount: number;
  /** Total words across all pages. */
  wordCount: number;
  /** False when the PDF is a scan/image with no extractable text layer. */
  hasTextLayer: boolean;
  /** Character count of each page's extracted text. */
  charCountPerPage: number[];
}

const EMPTY: PdfExtraction = {
  text: "",
  pages: [],
  pageCount: 0,
  wordCount: 0,
  hasTextLayer: false,
  charCountPerPage: [],
};

/** Stable normalization so output does not vary with incidental whitespace. */
function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \u00a0]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extracts and normalizes the text of a PDF.
 *
 * Never throws: a malformed or image-only PDF returns an empty result with
 * `hasTextLayer: false` (that itself is a valuable finding, not an error).
 */
export async function extractPdf(buffer: Buffer): Promise<PdfExtraction> {
  let rawPages: string[];
  let pageCount: number;
  try {
    // Copy the bytes: pdf.js may transfer (detach) the underlying buffer.
    const { totalPages, text } = await extractText(new Uint8Array(buffer), {
      mergePages: false,
    });
    rawPages = Array.isArray(text) ? text : [text];
    pageCount = totalPages;
  } catch {
    return { ...EMPTY };
  }

  const pages = rawPages.map(normalize);
  const charCountPerPage = pages.map((page) => page.length);
  const text = pages.join("\n\n").trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const totalChars = charCountPerPage.reduce((sum, n) => sum + n, 0);
  const hasTextLayer = totalChars >= MIN_TEXT_CHARS;

  return { text, pages, pageCount, wordCount, hasTextLayer, charCountPerPage };
}
