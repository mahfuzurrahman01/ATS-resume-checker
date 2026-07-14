import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Terms of Service - ATS Resume Checker",
};

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-400 mb-8">
        Last updated {new Date().toLocaleDateString()}
      </p>

      <Card className="bg-gray-900/20 border border-gray-700/30">
        <CardContent className="p-6 space-y-6 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              What this service is
            </h2>
            <p>
              ATS Resume Checker analyzes resumes for ATS compatibility and,
              optionally, fit against a job description. It uses a mix of
              deterministic checks (the same file always scores the same)
              and AI-generated feedback (Google Gemini). It is a tool to help
              you improve your resume — it is not a guarantee of any hiring
              outcome.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Accounts and credits
            </h2>
            <p>
              You need a Google account to sign in. New accounts start with
              free credits; scans and job matches each cost credits as shown
              before you use them. Credits do not expire. Paid credit packs
              (when available) are one-time purchases, not subscriptions,
              unless clearly stated otherwise at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Acceptable use
            </h2>
            <p>
              Don&apos;t use this service to upload documents you don&apos;t
              have the right to upload, to abuse or overload the system
              (automated scraping, scripted mass uploads, etc.), or to
              attempt to circumvent credit limits or rate limits. We may
              suspend accounts that abuse the service.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              AI feedback is not guaranteed
            </h2>
            <p>
              The AI-generated suggestions and rewrites are meant to help,
              not to be perfect. Always review AI-suggested changes before
              using them — you are responsible for the final content of your
              resume.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Your data
            </h2>
            <p>
              See our{" "}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>{" "}
              for what we collect and how to delete it. You own your resume
              content; we don&apos;t claim any rights to it beyond what&apos;s
              needed to run the analysis you asked for.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              No warranty
            </h2>
            <p>
              The service is provided as-is. We work to keep it accurate and
              available, but we don&apos;t guarantee uninterrupted access or
              that AI feedback will be error-free.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-2">
              Changes to these terms
            </h2>
            <p>
              We may update these terms as the product changes. Continued use
              after an update means you accept the revised terms.
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
              </Link>
              .
            </p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
