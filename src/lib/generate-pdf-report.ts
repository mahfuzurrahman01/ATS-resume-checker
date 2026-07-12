import type { ResumeData } from "@/lib/gemini-service";

// A4 portrait dimensions in millimetres.
const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN;

const COLORS = {
  heading: [37, 99, 235] as const,
  text: [40, 44, 52] as const,
  muted: [107, 114, 128] as const,
  green: [5, 150, 105] as const,
  amber: [217, 119, 6] as const,
  red: [220, 38, 38] as const,
  line: [220, 224, 230] as const,
};

function scoreColor(score: number): readonly [number, number, number] {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.amber;
  return COLORS.red;
}

function scoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Needs Improvement";
}

/**
 * Builds a clean, readable, multi-page ATS analysis PDF directly with jsPDF
 * (selectable text, proper pagination) and triggers a download.
 */
export async function generatePdfReport(data: ResumeData): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN;

  // --- layout helpers ------------------------------------------------------
  const ensure = (needed: number) => {
    if (y + needed > BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }
  };

  const setColor = (c: readonly [number, number, number]) =>
    doc.setTextColor(c[0], c[1], c[2]);

  const heading = (text: string) => {
    ensure(14);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    setColor(COLORS.heading);
    doc.text(text, MARGIN, y);
    y += 2.5;
    doc.setDrawColor(COLORS.line[0], COLORS.line[1], COLORS.line[2]);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    y += 5;
  };

  const paragraph = (
    text: string,
    opts: { size?: number; color?: readonly [number, number, number] } = {}
  ) => {
    if (!text) return;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(opts.size ?? 10.5);
    setColor(opts.color ?? COLORS.text);
    const lines = doc.splitTextToSize(text, CONTENT_W);
    for (const line of lines) {
      ensure(6);
      doc.text(line, MARGIN, y);
      y += 5.2;
    }
  };

  const bullets = (items: string[]) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    setColor(COLORS.text);
    for (const item of items) {
      const lines = doc.splitTextToSize(item, CONTENT_W - 5);
      lines.forEach((line: string, i: number) => {
        ensure(6);
        if (i === 0) doc.text("•", MARGIN, y);
        doc.text(line, MARGIN + 5, y);
        y += 5.2;
      });
      y += 1;
    }
  };

  const labelValue = (label: string, value?: string) => {
    if (!value) return;
    ensure(6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    setColor(COLORS.text);
    doc.text(`${label}: `, MARGIN, y);
    const labelW = doc.getTextWidth(`${label}: `);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(value, CONTENT_W - labelW);
    lines.forEach((line: string, i: number) => {
      if (i > 0) {
        ensure(6);
      }
      doc.text(line, MARGIN + (i === 0 ? labelW : 0), y);
      y += 5.2;
    });
  };

  // --- title ---------------------------------------------------------------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  setColor(COLORS.heading);
  doc.text("Resume ATS Analysis Report", MARGIN, y + 4);
  y += 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setColor(COLORS.muted);
  doc.text(`Generated on ${new Date().toLocaleDateString()}`, MARGIN, y);
  y += 4;

  // Not-a-resume short report.
  if (!data.is_resume) {
    heading("Document Type Error");
    paragraph(
      data.message ||
        "This document does not appear to be a resume or CV. Please upload a resume document for analysis."
    );
    doc.save(fileName());
    return;
  }

  // --- contact -------------------------------------------------------------
  if (data.header?.name) {
    heading("Contact Information");
    labelValue("Name", data.header.name);
    labelValue("Email", data.header.email);
    labelValue("Phone", data.header.phone);
    labelValue("Location", data.header.location);
    labelValue("LinkedIn", data.header.linkedin);
    labelValue("Website", data.header.website);
  }

  // --- score ---------------------------------------------------------------
  const score = data.ats_analysis?.score ?? 0;
  heading("ATS Compatibility Score");
  ensure(16);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setColor(scoreColor(score));
  doc.text(`${score}/100`, MARGIN, y + 6);
  doc.setFontSize(12);
  doc.text(scoreLabel(score), MARGIN + 45, y + 6);
  y += 11;
  // progress bar
  const barW = CONTENT_W;
  const barH = 3.5;
  doc.setFillColor(235, 237, 240);
  doc.roundedRect(MARGIN, y, barW, barH, 1.5, 1.5, "F");
  const sc = scoreColor(score);
  doc.setFillColor(sc[0], sc[1], sc[2]);
  doc.roundedRect(MARGIN, y, (barW * Math.min(score, 100)) / 100, barH, 1.5, 1.5, "F");
  y += barH + 4;

  // --- issues --------------------------------------------------------------
  const issues = data.ats_analysis?.issues ?? [];
  heading("Issues Found");
  if (issues.length) bullets(issues);
  else paragraph("No major issues found.", { color: COLORS.muted });

  // --- recommendations -----------------------------------------------------
  const recs = data.ats_analysis?.recommendations ?? [];
  heading("Recommendations");
  if (recs.length) bullets(recs);
  else paragraph("No specific recommendations at this time.", { color: COLORS.muted });

  // --- keywords ------------------------------------------------------------
  const found = data.ats_analysis?.keyword_matches ?? [];
  const missing = data.ats_analysis?.missing_keywords ?? [];
  heading("Keyword Analysis");
  doc.setFont("helvetica", "bold");
  ensure(6);
  setColor(COLORS.green);
  doc.setFontSize(10.5);
  doc.text(`Keywords Found (${found.length})`, MARGIN, y);
  y += 5.5;
  paragraph(found.length ? found.join(", ") : "None detected.", {
    color: found.length ? COLORS.text : COLORS.muted,
  });
  y += 1;
  ensure(6);
  doc.setFont("helvetica", "bold");
  setColor(COLORS.amber);
  doc.text(`Missing Keywords (${missing.length})`, MARGIN, y);
  y += 5.5;
  paragraph(missing.length ? missing.join(", ") : "None identified.", {
    color: missing.length ? COLORS.text : COLORS.muted,
  });

  // --- skills --------------------------------------------------------------
  const skills = data.sections?.skills;
  if (skills && (skills.technical?.length || skills.soft?.length || skills.languages?.length)) {
    heading("Skills");
    if (skills.technical?.length) {
      labelValue("Technical", skills.technical.join(", "));
      y += 1;
    }
    if (skills.soft?.length) {
      labelValue("Soft", skills.soft.join(", "));
      y += 1;
    }
    if (skills.languages?.length) {
      labelValue("Languages", skills.languages.join(", "));
    }
  }

  // --- detailed report sections (paid) -------------------------------------
  if (data.jd_match) {
    heading("Job Description Match");
    ensure(10);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    setColor(scoreColor(data.jd_match.match_score));
    doc.text(`${data.jd_match.match_score}% match`, MARGIN, y + 4);
    y += 9;
    paragraph(data.jd_match.summary);
    if (data.jd_match.title_alignment) {
      labelValue("Title fit", data.jd_match.title_alignment);
      y += 1;
    }
    if (data.jd_match.matched_keywords?.length) {
      labelValue("Matched", data.jd_match.matched_keywords.join(", "));
      y += 1;
    }
    if (data.jd_match.missing_keywords?.length) {
      labelValue("Missing", data.jd_match.missing_keywords.join(", "));
    }
  }

  if (data.bullet_rewrites?.length) {
    heading("AI Bullet Rewrites");
    for (const item of data.bullet_rewrites) {
      paragraph(`Before: ${item.original}`, { color: COLORS.muted });
      paragraph(`After:  ${item.improved}`);
      if (item.reason) paragraph(`Why: ${item.reason}`, { size: 9.5, color: COLORS.muted });
      y += 2;
    }
  }

  if (data.parse_preview) {
    heading("ATS Parse Preview");
    paragraph(
      "This is the plain text an ATS is likely to extract from your resume:",
      { size: 9.5, color: COLORS.muted }
    );
    y += 1;
    paragraph(data.parse_preview, { size: 9.5 });
  }

  // --- footer on every page ------------------------------------------------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor(COLORS.muted);
    doc.text(
      "Generated by ATS Resume Checker",
      MARGIN,
      PAGE_H - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, {
      align: "right",
    });
  }

  doc.save(fileName());
}

function fileName(): string {
  return `resume-analysis-${new Date().toISOString().split("T")[0]}.pdf`;
}
