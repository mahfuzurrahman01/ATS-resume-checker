"use client";

import React, { useState, useEffect } from "react";
import { FileText, Search, CheckCircle, Sparkles, Zap } from "lucide-react";

interface LoadingAnimationProps {
  isProcessing: boolean;
}

const stages = [
  {
    icon: <FileText className="h-12 w-12 text-blue-500" />,
    title: "Uploading Resume",
    description: "Processing your document securely...",
    duration: 2000,
    color: "blue",
  },
  {
    icon: <Search className="h-12 w-12 text-green-500" />,
    title: "Extracting Data",
    description: "Analyzing resume content and structure...",
    duration: 3000,
    color: "green",
  },
  {
    icon: <Sparkles className="h-12 w-12 text-purple-500" />,
    title: "AI Analysis",
    description: "Running advanced ATS compatibility analysis...",
    duration: 2500,
    color: "purple",
  },
  {
    icon: <CheckCircle className="h-12 w-12 text-emerald-500" />,
    title: "Almost There",
    description: "Finalizing your comprehensive report...",
    duration: 1500,
    color: "emerald",
  },
];

export function LoadingAnimation({ isProcessing }: LoadingAnimationProps) {
  const [currentStage, setCurrentStage] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStage(0);
      setProgress(0);
      return;
    }

    let stageIndex = 0;
    let stageProgress = 0;
    const totalDuration = stages.reduce(
      (sum, stage) => sum + stage.duration,
      0
    );

    const interval = setInterval(() => {
      if (stageIndex < stages.length) {
        const currentStageDuration = stages[stageIndex].duration;
        stageProgress += 50; // Update every 50ms

        if (stageProgress >= currentStageDuration) {
          stageIndex++;
          stageProgress = 0;
          setCurrentStage(stageIndex);
        }

        const overallProgress = Math.min(
          ((stageIndex * 1000 + stageProgress) / totalDuration) * 100,
          100
        );
        setProgress(overallProgress);
      } else {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isProcessing]);

  if (!isProcessing) return null;

  const currentStageData = stages[currentStage] || stages[0];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-gray-900/90 backdrop-blur-xl rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl border border-gray-700/30 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-2xl"></div>
        </div>

        <div className="text-center space-y-8 relative z-10">
          {/* Enhanced Animated Icon with 3D Effect */}
          <div className="relative">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-400 rounded-3xl blur-xl opacity-40 animate-pulse"></div>
              <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-3xl p-8 shadow-2xl border border-gray-600/50">
                <div className="animate-bounce">{currentStageData.icon}</div>
              </div>
            </div>
            <div className="absolute -top-3 -right-3">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-ping shadow-lg"></div>
            </div>
            <div className="absolute -bottom-3 -left-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse shadow-lg"></div>
            </div>
            <div className="absolute top-1/2 -right-8 transform -translate-y-1/2">
              <div className="w-4 h-4 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full animate-bounce shadow-lg"></div>
            </div>
          </div>

          {/* Enhanced Progress Bar */}
          <div className="space-y-4">
            <div className="w-full bg-gray-800 rounded-full h-4 overflow-hidden shadow-inner">
              <div
                className="bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 h-4 rounded-full transition-all duration-300 ease-out shadow-lg relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent rounded-full"></div>
              </div>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300 font-medium">Processing</span>
              <span className="font-bold text-white text-lg">
                {Math.round(progress)}%
              </span>
            </div>
          </div>

          {/* Enhanced Stage Info */}
          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-white">
              {currentStageData.title}
            </h3>
            <p className="text-gray-300 leading-relaxed text-lg">
              {currentStageData.description}
            </p>
          </div>

          {/* Enhanced Animated Dots */}
          <div className="flex justify-center space-x-3">
            {[0, 1, 2, 3].map((dot) => (
              <div
                key={dot}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  dot === currentStage
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 scale-125 shadow-lg"
                    : "bg-gray-600"
                }`}
              ></div>
            ))}
          </div>

          {/* Enhanced Pro Tip */}
          <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-700/30 shadow-lg">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-white">Pro Tip</p>
                <p className="text-sm text-gray-300 mt-1">
                  Our AI analyzes 50+ ATS systems for maximum accuracy and
                  compatibility
                </p>
              </div>
            </div>
          </div>

          {/* Loading animation */}
          <div className="flex justify-center">
            <div className="flex space-x-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.1}s` }}
                ></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
