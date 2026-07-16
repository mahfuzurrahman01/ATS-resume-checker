import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Privacy Policy",
  description: "How ATSBuddy collects, stores, and protects your resume data.",
};

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">
        Last updated {new Date().toLocaleDateString()}
      </p>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardContent className="p-6 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              What we collect
            </h2>
            <p>
              When you upload a resume, we collect the PDF file itself, the
              plain text we extract from it, and the job descriptions you
              paste in for a match. We also collect your email address and
              name from your Google sign-in.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Why we collect it
            </h2>
            <p>
              To run the analysis you asked for: scoring your resume,
              checking it against ATS-readability rules, and comparing it to
              a job description when you request a match. Your email
              identifies your account and credit balance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Who we share it with
            </h2>
            <p>
              The extracted text of your resume (and job description, for
              matches) is sent to Google Gemini to generate the AI feedback.
              We don&apos;t sell your data or share it with anyone else. Your
              account and files are hosted on Supabase (database, auth, and
              file storage) — our infrastructure provider, not a third party
              we share data with for their own purposes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              How long we keep it
            </h2>
            <p>
              Until you delete it. You can delete an individual resume (and
              everything derived from it — its scans and job matches) from{" "}
              <Link href="/resumes" className="underline">
                My Resumes
              </Link>
              , or delete your entire account and all associated data from{" "}
              <Link href="/settings" className="underline">
                Settings
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              How to delete your data
            </h2>
            <p>
              Go to Settings → Delete my account. This is a one-click action
              (after confirming by typing your email) and is irreversible: it
              removes every resume file, all analysis results, and your
              account itself.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Questions
            </h2>
            <p>
              Reach out via the{" "}
              <Link href="/contact" className="underline">
                contact page
              </Link>{" "}
              if you have questions about your data.
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
