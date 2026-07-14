import Link from "next/link";
import { ArrowRight, ScanLine, Target, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { SignInGate } from "@/components/SignInGate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/ui/score-badge";

// Public marketing landing page. No uploader here — the product itself
// lives at /scan (auth required).
export default async function Home() {
  const user = await getCurrentUser();

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-5xl font-bold mb-6">
          <span className="text-white">Craft Perfect</span>
          <br />
          <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Resumes for ATS
          </span>
        </h1>
        <p className="text-lg text-gray-300 max-w-2xl mx-auto leading-relaxed mb-8">
          A deterministic ATS score you can trust, AI feedback that never
          invents facts about your resume, and a job-match report that tells
          you honestly whether you&apos;re a fit.
        </p>

        {user ? (
          <Link href="/scan">
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white"
            >
              <ScanLine className="h-5 w-5 mr-2" />
              Scan a resume
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </Link>
        ) : (
          <SignInGate />
        )}
      </div>

      {/* What it does */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-16">
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-blue-900/40 flex items-center justify-center">
              <ScanLine className="h-5 w-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Scan</h3>
            <p className="text-sm text-gray-300">
              Upload your resume by itself. Get a deterministic 0-100 score,
              mechanical ATS checks, and AI feedback on your writing — the
              same resume always scores the same.
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gray-900/20 border border-gray-700/30">
          <CardContent className="p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/40 flex items-center justify-center">
              <Target className="h-5 w-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-semibold text-white">Match</h3>
            <p className="text-sm text-gray-300">
              Paste a job description and see how well your resume actually
              fits — an honest verdict, missing must-have keywords, and
              tailored bullet rewrites.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sample report mockup */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-white text-center mb-2">
          A score you can trust
        </h2>
        <p className="text-gray-300 text-center mb-8 max-w-xl mx-auto">
          The score is computed in code from objective checks — not guessed by
          an AI. Sample report shown below.
        </p>
        <Card className="bg-gray-900/20 border border-gray-700/30 max-w-2xl mx-auto">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <span className="text-white font-medium">
                  resume-sample.pdf
                </span>
              </div>
              <ScoreBadge score={78} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                ["Parseability", "26/30"],
                ["Structure", "18/20"],
                ["Contact", "15/15"],
                ["Content", "14/25"],
                ["Formatting", "5/10"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl bg-gray-800/40 border border-gray-700/40 p-3 text-center"
                >
                  <p className="text-lg font-bold text-white">{value}</p>
                  <p className="text-xs text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pricing teaser */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-3">
          10 free credits to start
        </h2>
        <p className="text-gray-300 mb-6">
          A scan costs 1 credit, a job match costs 2. Buy more whenever you
          need them.
        </p>
        <Link href="/pricing">
          <Button
            variant="outline"
            className="bg-gray-900/40 border-gray-700/40 text-gray-200 hover:bg-gray-800/40"
          >
            See pricing
          </Button>
        </Link>
      </div>

      <footer className="text-center mt-20 text-gray-400 text-sm space-y-3">
        <p className="bg-gray-900/50 backdrop-blur-sm rounded-full px-6 py-3 inline-block border border-gray-700/30">
          Your resume is stored privately in your account. You can delete it
          at any time.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link href="/privacy" className="hover:text-gray-200">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:text-gray-200">
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
