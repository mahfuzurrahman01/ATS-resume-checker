"use client";

import React from "react";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Target,
  Lightbulb,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ResumeData } from "@/lib/gemini-service";
import { safeUrl, displayUrl } from "@/lib/utils";

interface ResultsDisplayProps {
  data: ResumeData;
  onReset: () => void;
}

export function ResultsDisplay({ data, onReset }: ResultsDisplayProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-6 w-6 text-green-600" />;
    if (score >= 60)
      return <AlertTriangle className="h-6 w-6 text-yellow-600" />;
    return <XCircle className="h-6 w-6 text-red-600" />;
  };

  // Show error message if it's not a resume
  if (!data.is_resume) {
    return (
      <div className="space-y-6 w-full max-w-4xl mx-auto">
        <Card className="bg-red-900/20 backdrop-blur-xl border border-red-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <XCircle className="h-6 w-6 text-red-400" />
              <span>Document Type Error</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center space-y-4">
              <p className="text-lg text-red-300 font-medium">
                {data.message ||
                  "This document does not appear to be a resume or CV."}
              </p>
              <p className="text-gray-300">
                Please upload a resume or CV document for ATS compatibility
                analysis.
              </p>
              <Button
                onClick={onReset}
                className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
              >
                Upload Different File
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {/* Overall Score */}
      <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-white">
            <Target className="h-6 w-6 text-blue-400" />
            <span>ATS Compatibility Score</span>
          </CardTitle>
          <CardDescription className="text-gray-300">
            Your resume&apos;s compatibility with Applicant Tracking Systems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {getScoreIcon(data?.ats_analysis?.score || 0)}
                <span
                  className={`text-2xl font-bold ${getScoreColor(
                    data?.ats_analysis?.score || 0
                  )}`}
                >
                  {data?.ats_analysis?.score || 0}/100
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {(data?.ats_analysis?.score || 0) >= 80
                  ? "Excellent"
                  : (data?.ats_analysis?.score || 0) >= 60
                  ? "Good"
                  : (data?.ats_analysis?.score || 0) >= 40
                  ? "Fair"
                  : "Needs Improvement"}
              </div>
            </div>
            <Progress
              value={data?.ats_analysis?.score}
              max={100}
              className="h-3"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      {data?.header?.name && (
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Contact Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="font-medium text-white">{data?.header?.name}</p>
                <p className="text-sm text-gray-300">{data?.header?.email}</p>
                <p className="text-sm text-gray-300">{data?.header?.phone}</p>
                <p className="text-sm text-gray-300">
                  {data?.header?.location}
                </p>
              </div>
              {(safeUrl(data?.header?.linkedin) ||
                safeUrl(data?.header?.website)) && (
                <div className="space-y-1">
                  {safeUrl(data?.header?.linkedin) && (
                    <p className="text-sm">
                      <span className="text-gray-400">LinkedIn: </span>
                      <a
                        href={safeUrl(data?.header?.linkedin)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={safeUrl(data?.header?.linkedin)}
                        className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                      >
                        {displayUrl(data?.header?.linkedin)}
                      </a>
                    </p>
                  )}
                  {safeUrl(data?.header?.website) && (
                    <p className="text-sm">
                      <span className="text-gray-400">Website: </span>
                      <a
                        href={safeUrl(data?.header?.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={safeUrl(data?.header?.website)}
                        className="text-blue-400 hover:text-blue-300 transition-colors break-all"
                      >
                        {displayUrl(data?.header?.website)}
                      </a>
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Issues and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Issues */}
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <XCircle className="h-5 w-5 text-red-400" />
              <span>Issues Found</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.ats_analysis?.issues?.length || 0) > 0 ? (
              <ul className="space-y-2">
                {data?.ats_analysis?.issues?.map((issue, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <XCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{issue}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No major issues found!</p>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <Lightbulb className="h-5 w-5 text-yellow-400" />
              <span>Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.ats_analysis?.recommendations?.length || 0) > 0 ? (
              <ul className="space-y-2">
                {data?.ats_analysis?.recommendations?.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">
                No specific recommendations at this time.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Keyword Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Found Keywords */}
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span>
                Keywords Found ({data?.ats_analysis?.keyword_matches?.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.ats_analysis?.keyword_matches?.length || 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data?.ats_analysis?.keyword_matches?.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-900/50 text-green-300 text-xs rounded-full border border-green-700/30"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No keywords detected</p>
            )}
          </CardContent>
        </Card>

        {/* Missing Keywords */}
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-white">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span>
                Missing Keywords ({data?.ats_analysis?.missing_keywords?.length}
                )
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.ats_analysis?.missing_keywords?.length || 0) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {data?.ats_analysis?.missing_keywords?.map((keyword, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-yellow-900/50 text-yellow-300 text-xs rounded-full border border-yellow-700/30"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                No missing keywords identified
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Skills Section */}
      {data?.sections?.skills && (
        <Card className="bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Skills Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data?.sections?.skills?.technical?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-white">
                    Technical Skills
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {data?.sections?.skills?.technical?.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-900/50 text-blue-300 text-sm rounded-full border border-blue-700/30"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data?.sections?.skills?.soft?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2 text-white">Soft Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {data?.sections?.skills?.soft?.map((skill, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-purple-900/50 text-purple-300 text-sm rounded-full border border-purple-700/30"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data?.sections?.skills?.languages &&
                data?.sections?.skills?.languages?.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2 text-white">Languages</h4>
                    <div className="flex flex-wrap gap-2">
                      {data?.sections?.skills?.languages?.map(
                        (language, index) => (
                          <span
                            key={index}
                            className="px-3 py-1 bg-green-900/50 text-green-300 text-sm rounded-full border border-green-700/30"
                          >
                            {language}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
