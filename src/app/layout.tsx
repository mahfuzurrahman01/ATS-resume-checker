import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Background } from "@/components/Background";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { CreditsProvider } from "@/lib/credits-context";
import { getCurrentUser, getUserCredits } from "@/lib/auth";
const inter = Inter({ subsets: ["latin"] });
import "./globals.css";
const siteUrl = "https://www.atsbuddy.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "ATSBuddy - Free ATS Resume Checker & Resume Score",
    template: "%s | ATSBuddy",
  },
  description:
    "Check if your resume is ATS friendly in seconds. Get a free ATS resume score, AI-powered feedback, and a job-match report that tells you honestly whether you're a fit — before you apply.",
  keywords: [
    "ats resume checker",
    "ats friendly resume",
    "resume checker",
    "resume score checker",
    "free resume checker",
    "is my resume ats friendly",
    "applicant tracking system checker",
    "resume ats scan",
    "best resume checker",
    "ai resume analysis",
    "job match checker",
    "resume keyword checker",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "ATSBuddy - Free ATS Resume Checker & Resume Score",
    description:
      "Check if your resume is ATS friendly in seconds. Free ATS resume score, AI feedback, and honest job-match scoring.",
    type: "website",
    url: siteUrl,
    siteName: "ATSBuddy",
  },
  twitter: {
    card: "summary_large_image",
    title: "ATSBuddy - Free ATS Resume Checker",
    description:
      "Check if your resume is ATS friendly in seconds. Free ATS resume score and AI feedback.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const credits = user
    ? await getUserCredits(user.id)
    : { balance: 0, isLifetime: false };

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "ATSBuddy",
        url: siteUrl,
      },
      {
        "@type": "SoftwareApplication",
        name: "ATSBuddy",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any (web-based)",
        url: siteUrl,
        description:
          "AI-powered ATS resume checker. Get a deterministic ATS compatibility score, AI feedback, and job-match scoring.",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free credits included on signup",
        },
      },
    ],
  };

  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <CreditsProvider
          initial={{ balance: credits.balance, isLifetime: credits.isLifetime }}
          loggedIn={!!user}
        >
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
        </CreditsProvider>
      </body>
    </html>
  );
}
