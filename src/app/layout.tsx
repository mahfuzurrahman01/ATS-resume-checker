import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Background } from "@/components/Background";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ATS Resume Checker - AI-Powered Resume Optimization",
  description:
    "Get instant AI-powered feedback on your resume's ATS compatibility. Optimize your resume to pass through ATS filters.",
  keywords: [
    "ATS resume checker",
    "resume optimization",
    "applicant tracking system",
    "AI resume analysis",
  ],
  openGraph: {
    title: "ATS Resume Checker - AI-Powered Resume Optimization",
    description:
      "Get instant AI-powered feedback on your resume's ATS compatibility.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ATS Resume Checker",
    description:
      "Get instant AI-powered feedback on your resume's ATS compatibility.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <div className="min-h-screen w-full relative !bg-transparent">
          <Background />
          <SpeedInsights />
          {/* Content */}
          <div className="relative z-10">
            <Analytics />
            <Navbar />
            <div className="text-white !bg-transparent">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
