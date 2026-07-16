export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  content: BlogBlock[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "is-my-resume-ats-friendly",
    title: "Is My Resume ATS Friendly? 7 Things to Check",
    description:
      "A practical checklist for whether your resume will actually parse cleanly through an Applicant Tracking System — no guesswork, no jargon.",
    publishedAt: "2026-07-17",
    content: [
      {
        type: "p",
        text: "Most ATS software doesn't reject resumes because they're a bad fit for the job — it rejects them because it literally can't read them correctly. A recruiter never sees a resume that got mangled on import. Here's what actually breaks parsing, based on the checks that matter most.",
      },
      { type: "h2", text: "1. Your file has a real text layer" },
      {
        type: "p",
        text: "If your resume is a scanned image or a PDF exported from a design tool without embedded text, an ATS sees a blank page. Export directly from a word processor or a PDF generator that preserves selectable text — you should be able to highlight and copy every word in a PDF viewer.",
      },
      { type: "h2", text: "2. No tables or multi-column layouts" },
      {
        type: "p",
        text: "Two-column resumes look great to a human eye but most ATS parsers read left-to-right, top-to-bottom in a single stream — so a skills column next to an experience column gets interleaved into nonsense. Same problem with tables used for layout. Stick to a single column.",
      },
      { type: "h2", text: "3. Standard section headings" },
      {
        type: "p",
        text: "\"Where I've Made Impact\" might read better than \"Work Experience\" to a person, but ATS software matches on standard section names. Use conventional headings: Experience, Education, Skills, Summary.",
      },
      { type: "h2", text: "4. Contact info isn't hiding in a header or footer" },
      {
        type: "p",
        text: "Many ATS parsers skip document headers and footers entirely — so if your name, email, or phone number only live there, they may never get extracted at all. Put contact details in the main body, at the top of the document.",
      },
      { type: "h2", text: "5. No icons or special characters glued to contact details" },
      {
        type: "p",
        text: "A phone icon or email glyph placed directly next to your phone number or email address can break how some parsers tokenize that field. Plain text is safer than decorative icons for anything the ATS needs to extract.",
      },
      { type: "h2", text: "6. Dates are in a parseable format" },
      {
        type: "p",
        text: "\"2019 - Present\" or \"Jan 2019 - Mar 2022\" parse reliably. Creative date formatting, or omitting dates entirely, makes it hard for an ATS (and a recruiter) to calculate your experience automatically.",
      },
      { type: "h2", text: "7. Reasonable length" },
      {
        type: "p",
        text: "Extremely short resumes often mean missing sections the ATS expects; resumes well over two pages tend to bury the keywords that matter under less relevant detail. One to two pages is the safe range for most roles.",
      },
      {
        type: "p",
        text: "Checking all seven manually is doable, but it's easy to miss layout issues that aren't visible just by looking at the file. ATSBuddy runs these checks (and more) automatically and gives you a deterministic score — the same resume always scores the same, because it's not guessed by an AI.",
      },
    ],
  },
  {
    slug: "how-to-make-resume-ats-friendly",
    title: "How to Make Your Resume ATS Friendly: A Complete Guide",
    description:
      "Step-by-step guide to fixing the formatting, structure, and content issues that keep resumes from passing ATS screening.",
    publishedAt: "2026-07-17",
    content: [
      {
        type: "p",
        text: "Making a resume ATS friendly isn't about gaming a system — it's about removing formatting choices that get in the way of the resume being read correctly, by software or by a person skimming it fast. Here's how to do it, in order.",
      },
      { type: "h2", text: "Start with a single-column layout" },
      {
        type: "p",
        text: "Multi-column layouts, sidebars, and text boxes are the single most common cause of parsing failures. Rebuild your resume as one continuous column, top to bottom.",
      },
      { type: "h2", text: "Use a real word processor or ATS-safe PDF export" },
      {
        type: "p",
        text: "Avoid resume templates built in graphic design tools unless you've confirmed the export keeps a real text layer. Google Docs, Word, and most modern resume builders export ATS-readable PDFs by default.",
      },
      { type: "h2", text: "Name your sections conventionally" },
      {
        type: "ul",
        items: [
          "Summary or Professional Summary",
          "Experience or Work Experience",
          "Education",
          "Skills",
          "Certifications (if relevant)",
        ],
      },
      { type: "h2", text: "Put contact info in the body, not the header" },
      {
        type: "p",
        text: "Name, email, phone, and LinkedIn URL should be plain text at the top of the main document body — not inside a header/footer region, and not wrapped in icons that could interfere with parsing.",
      },
      { type: "h2", text: "Write bullets that quantify impact" },
      {
        type: "p",
        text: "\"Responsible for managing a team\" is weak both for ATS keyword matching and for a human reader. \"Managed a team of 6, reducing onboarding time by 30%\" gives a parser and a recruiter something concrete to match against.",
      },
      { type: "h2", text: "Match keywords from the job description — honestly" },
      {
        type: "p",
        text: "ATS systems and recruiters both look for specific skills and tools named in the job posting. If you have the experience, use the same terminology the posting uses. Don't invent skills you don't have just to pass a keyword filter — that fails the human interview stage instead.",
      },
      { type: "h2", text: "Check your work" },
      {
        type: "p",
        text: "After making changes, it helps to run the resume through an actual ATS-style parser rather than guessing. ATSBuddy scores your resume against these exact checks and tells you specifically what's still broken, plus AI feedback on the writing itself.",
      },
    ],
  },
  {
    slug: "free-ats-resume-checker",
    title: "Free ATS Resume Checker: What It Actually Checks For",
    description:
      "What a good ATS resume checker actually analyzes, and how ATSBuddy's free credits let you test it before you apply anywhere.",
    publishedAt: "2026-07-17",
    content: [
      {
        type: "p",
        text: "\"ATS resume checker\" gets searched a lot, but the tools behind that search term vary wildly — some just count keywords, others actually simulate how a parser reads your document. Here's what a checker should actually be looking at, and how ATSBuddy approaches it.",
      },
      { type: "h2", text: "Parseability" },
      {
        type: "p",
        text: "Does the file have a real text layer? Is it structured as a single readable column, or will a parser scramble a multi-column layout? This is the foundation — everything else is irrelevant if the ATS can't read the document at all.",
      },
      { type: "h2", text: "Structure" },
      {
        type: "p",
        text: "Are section headings standard? Are dates in a parseable format? Is the resume a reasonable length? These affect whether the ATS extracts your work history and education correctly.",
      },
      { type: "h2", text: "Contact details" },
      {
        type: "p",
        text: "Is your name, email, and phone number somewhere a parser will actually find them — not buried in a header/footer, not glued to icons that break extraction?",
      },
      { type: "h2", text: "Content quality" },
      {
        type: "p",
        text: "Beyond parsing, do your bullets show quantified, specific impact instead of vague responsibilities? This is where AI feedback is genuinely useful — a deterministic check can catch \"weak verb openers,\" but nuanced writing feedback benefits from a model reading it in context.",
      },
      { type: "h2", text: "Job match, if you have a posting" },
      {
        type: "p",
        text: "A separate but related question: even if your resume is perfectly parseable, does it actually fit this specific job? ATSBuddy's job-match report compares your resume against a pasted job description and gives an honest verdict, missing must-have keywords, and rewrite suggestions — not just a generic score.",
      },
      { type: "h2", text: "Why ATSBuddy is deterministic where it can be" },
      {
        type: "p",
        text: "The core ATS score is computed in code from objective checks — the same resume always scores the same, it isn't guessed by an AI each time. AI is used specifically for the parts that need judgment: writing feedback and job-match analysis. You get 10 free credits on signup, enough to try both a scan and a job match before deciding if you need more.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
