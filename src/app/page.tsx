"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileUpload } from "@/components/FileUpload";
import { ResultsDisplay } from "@/components/ResultsDisplay";
import { ProSuggestions } from "@/components/ProSuggestions";
import { DetailedReport } from "@/components/DetailedReport";
import { LoadingAnimation } from "@/components/LoadingAnimation";
import { ResumeData } from "@/lib/gemini-service";
import { Button } from "@/components/ui/button";
import { Upload, Download, Github, Code, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  // Refs for GSAP animations
  const headerRef = useRef<HTMLDivElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const secondaryButtonsRef = useRef<HTMLDivElement>(null);
  const uploadRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  // GSAP animations on mount
  useEffect(() => {
    if (!results) {
      const tl = gsap.timeline({ delay: 0.2 });

      // Animate banner
      tl.fromTo(
        bannerRef.current,
        { y: -50, opacity: 0, scale: 0.8 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: "back.out(1.7)" }
      )

        // Animate title
        .fromTo(
          titleRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power2.out" },
          "-=0.3"
        )

        // Animate description
        .fromTo(
          descriptionRef.current,
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
          "-=0.4"
        )

        // Animate secondary buttons
        .fromTo(
          secondaryButtonsRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
          "-=0.4"
        )

        // Animate upload section
        .fromTo(
          uploadRef.current,
          { y: 40, opacity: 0, scale: 0.95 },
          { y: 0, opacity: 1, scale: 1, duration: 0.8, ease: "back.out(1.7)" },
          "-=0.3"
        )

        // Animate stats
        .fromTo(
          statsRef.current,
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" },
          "-=0.4"
        );
    }
  }, [results]);

  const analyze = async (
    file: File,
    mode: "basic" | "detailed" = "basic",
    jobDescription?: string
  ) => {
    setIsProcessing(true);
    setError(null);
    if (mode === "basic") setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mode", mode);
      if (jobDescription) formData.append("jobDescription", jobDescription);

      const response = await fetch("/api/process-resume", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const err = new Error(data.error || "Failed to process resume");
        // Surface the machine code so the UI can react (e.g. out of credits).
        (err as Error & { code?: string }).code = data.code;
        throw err;
      }

      if (data.success && data.data) {
        setResults(data.data);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileSelect = async (file: File) => {
    setLastFile(file);
    await analyze(file, "basic");
  };

  const handleGetDetailed = async (jobDescription?: string) => {
    if (!lastFile) return;
    await analyze(lastFile, "detailed", jobDescription);
  };

  const handleReset = () => {
    setResults(null);
    setError(null);
    setLastFile(null);
  };

  const handleDownloadReport = async () => {
    if (!results) return;
    try {
      const { generatePdfReport } = await import("@/lib/generate-pdf-report");
      await generatePdfReport(results);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  return (
    <>
      {/* Loading Animation */}
      <LoadingAnimation isProcessing={isProcessing} />
      <div className="w-full relative">
        {/* Your Content/Components */}
        <div className="container mx-auto px-4 py-8 z-40 relative max-w-7xl">
          {/* Main Content */}
          <div className="max-w-4xl mx-auto">
            {!results ? (
              <div className="space-y-12">
                {/* Header */}
                <div ref={headerRef} className="text-center mb-16">
                  {/* Enhanced New Features Banner */}
                  <div
                    ref={bannerRef}
                    className="inline-flex items-center space-x-3 bg-gray-900/80 backdrop-blur-sm rounded-full px-6 py-3 mb-8 shadow-lg border border-gray-700/20 hover:shadow-xl transition-all duration-300 group"
                  >
                    <div className="w-3 h-3 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                      3+ New Features
                    </span>
                    <div className="w-5 h-5 bg-gradient-to-r from-orange-400 to-red-500 rounded-full flex items-center justify-center animate-bounce">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-sm text-gray-400 group-hover:text-gray-200 transition-colors">
                      Coming Soon →
                    </span>
                  </div>

                  <h1 ref={titleRef} className="text-5xl font-bold mb-6">
                    <span className="text-white">Craft Perfect</span>
                    <br />
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                      Resumes for ATS
                    </span>
                  </h1>
                  <p
                    ref={descriptionRef}
                    className="text-lg text-gray-300 max-w-3xl mx-auto leading-relaxed"
                  >
                    Professional-grade resume analysis and optimization. Get
                    instant AI-powered feedback to ensure your resume passes
                    through Applicant Tracking Systems seamlessly.
                  </p>
                </div>

                {/* Enhanced Compact File Upload */}
                <div ref={uploadRef} className="max-w-lg mx-auto">
                  <FileUpload
                    onFileSelect={handleFileSelect}
                    isProcessing={isProcessing}
                  />
                </div>

                {/* Enhanced Secondary Action Buttons */}
                <div
                  ref={secondaryButtonsRef}
                  className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto mt-8"
                >
                  <Button
                    variant="outline"
                    className="group bg-gray-900 hover:bg-gray-800 text-white border-gray-900 rounded-xl p-4 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    onClick={() =>
                      window.open(
                        "https://github.com/mahfuzurrahman01/ATS-resume-checker",
                        "_blank"
                      )
                    }
                  >
                    <Github className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                    Contribute Here!
                  </Button>

                  <Button
                    variant="outline"
                    className="group bg-white hover:bg-gray-50 text-gray-900 dark:bg-gray-900 dark:hover:bg-gray-800 dark:text-white border border-gray-300 dark:border-gray-700 rounded-xl p-4 h-auto shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                    onClick={() => router.push("/about")}
                  >
                    <Code className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                    Browse Features
                  </Button>
                </div>

                {/* Hidden file input for main upload button */}

                {/* Enhanced Error Display */}
                {error && (
                  <div className="bg-gradient-to-r from-red-100 to-pink-100 dark:from-red-50 dark:to-pink-50 border border-red-300 dark:border-red-200 rounded-2xl p-6 max-w-md mx-auto shadow-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="font-semibold text-red-800 dark:text-red-700">
                        Error
                      </span>
                    </div>
                    <p className="text-red-700 dark:text-red-600 mt-3 text-center">
                      {error}
                    </p>
                  </div>
                )}

                {/* Enhanced Statistics Section */}
                <div
                  ref={statsRef}
                  className="border-t border-gray-200/50 dark:border-gray-700/50 pt-12 mt-20"
                >
                  <div className="grid grid-cols-3 gap-8 text-center">
                    <div className="group">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-300">
                        100+
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        ATS Systems
                      </div>
                    </div>
                    <div className="group">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">
                        100%
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Free
                      </div>
                    </div>
                    <div className="group">
                      <div className="text-4xl font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-300">
                        AI
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        & Analysis
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {/* Results Display */}
                {/* Action Buttons - Only show when results are available */}
                {results && (
                  <div className="flex justify-start space-x-3 mb-6">
                    <Button
                      onClick={handleReset}
                      variant="outline"
                      size="sm"
                      className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 text-white hover:bg-gray-800/30 hover:border-gray-600/30"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Another Resume
                    </Button>
                    <Button
                      onClick={handleDownloadReport}
                      size="sm"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Report
                    </Button>
                  </div>
                )}
                <ResultsDisplay data={results} onReset={handleReset} />

                {/* Pro Suggestions */}
                <ProSuggestions data={results} />

                {/* Inline error (e.g. out of credits on detailed request) */}
                {error && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-4 text-center">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                {/* Detailed Report — unlock CTA or paid results */}
                {results.is_resume && (
                  <DetailedReport
                    data={results}
                    isProcessing={isProcessing}
                    onRequest={handleGetDetailed}
                  />
                )}
              </div>
            )}
          </div>

          {/* Enhanced Footer */}
          <footer className="text-center mt-20 text-gray-400 text-sm">
            <p className="bg-gray-900/50 backdrop-blur-sm rounded-full px-6 py-3 inline-block border border-gray-700/30">
              Built with Next.js, TypeScript, and Gemini AI. Your resume data is
              processed securely and not stored.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
