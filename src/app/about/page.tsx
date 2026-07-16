import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Target, Zap, Shield } from "lucide-react";

export const metadata = {
  title: "About",
  description:
    "Why ATSBuddy exists: a deterministic ATS score you can trust plus honest AI feedback on your resume.",
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">About ATSBuddy</h1>
          <p className="text-xl text-muted-foreground">
            Empowering job seekers with AI-powered resume optimization
          </p>
        </div>

        {/* Mission */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-6 w-6" />
              <span>Our Mission</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg leading-relaxed">
              We believe every job seeker deserves to have their resume
              optimized for success. Our AI-powered platform helps you create
              ATS-friendly resumes that get past Applicant Tracking Systems and
              into the hands of hiring managers.
            </p>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600" />
                <span>Smart Analysis</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Our advanced AI analyzes your resume structure, content, and
                formatting to identify areas for improvement and ATS
                compatibility.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                <span>Instant Feedback</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Get immediate, actionable feedback on your resume with detailed
                recommendations and keyword analysis.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-600" />
                <span>ATS Optimization</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Ensure your resume passes through Applicant Tracking Systems
                with our specialized ATS compatibility scoring and optimization
                tips.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5 text-purple-600" />
                <span>Privacy First</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Your resume is stored privately in your account, used only to
                run your analysis, and you can delete it at any time from
                Settings. See our{" "}
                <a href="/privacy" className="underline">
                  Privacy Policy
                </a>{" "}
                for details.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Technology */}
        <Card>
          <CardHeader>
            <CardTitle>Technology</CardTitle>
            <CardDescription>
              Built with modern technologies for the best user experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="font-semibold">Next.js 14</div>
                <div className="text-sm text-muted-foreground">
                  React Framework
                </div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="font-semibold">TypeScript</div>
                <div className="text-sm text-muted-foreground">Type Safety</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="font-semibold">Gemini AI</div>
                <div className="text-sm text-muted-foreground">AI Analysis</div>
              </div>
              <div className="text-center p-4 bg-muted rounded-lg">
                <div className="font-semibold">Tailwind CSS</div>
                <div className="text-sm text-muted-foreground">Styling</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
