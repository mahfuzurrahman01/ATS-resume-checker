import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Background } from "@/components/Background";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ATS Resume Checker - AI-Powered Resume Optimization",
  description:
    "Get instant AI-powered feedback on your resume's ATS compatibility. Optimize your resume to pass through ATS filters.",
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

          {/* Content */}
          <div className="relative z-10">
            <Navbar />
            <div className="text-white !bg-transparent">{children}</div>
          </div>
        </div>
      </body>
    </html>
  );
}
