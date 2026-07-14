import { ScanClient } from "./ScanClient";

export const metadata = {
  title: "Scan a Resume - ATS Resume Checker",
};

export default function ScanPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">
          Scan your resume
        </h1>
        <p className="text-gray-300">
          Upload a PDF to get your ATS compatibility score, deterministic
          checks, and AI feedback on your content.
        </p>
      </div>
      <ScanClient />
    </div>
  );
}
