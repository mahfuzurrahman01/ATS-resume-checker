"use client";

import React, { useState, useCallback } from "react";
import { Upload, FileText, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditBadge } from "@/components/ui/credit-badge";
import { CREDIT_COST } from "@/lib/credit-costs";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export function FileUpload({ onFileSelect, isProcessing }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (!isValidFileType(file)) {
        setFileError("Unsupported file. Please upload a PDF.");
        setSelectedFile(null);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        const mb = (file.size / (1024 * 1024)).toFixed(1);
        setFileError(
          `That file is ${mb}MB — the limit is 10MB. A typical resume is under 1MB.`
        );
        setSelectedFile(null);
        return;
      }
      setFileError(null);
      setSelectedFile(file);
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const isValidFileType = (file: File): boolean => {
    // Gemini reliably parses PDF only, so PDF is the single supported format.
    return file.type === "application/pdf";
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="h-10 w-10 text-gray-400" />;
    if (selectedFile.type === "application/pdf") {
      return <FileText className="h-10 w-10 text-red-500" />;
    }
    return <FileText className="h-10 w-10 text-blue-500" />;
  };

  const getFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className="w-full bg-gray-900/20 backdrop-blur-xl border border-gray-700/30 shadow-2xl hover:shadow-3xl transition-all duration-300 rounded-3xl">
      <CardContent className="p-5">
        <div
          className={`border-2 border-dashed rounded-3xl p-5 text-center transition-all duration-300 relative overflow-hidden ${
            isDragOver
              ? "border-purple-400 bg-gray-900/40 backdrop-blur-md scale-105"
              : selectedFile
              ? "border-green-400 bg-gray-900/30 backdrop-blur-md"
              : "border-gray-600/50 hover:border-purple-300 hover:bg-gray-900/20 hover:scale-[1.02] backdrop-blur-sm"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-4 left-4 w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full blur-sm"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 bg-gradient-to-br from-blue-400 to-cyan-400 rounded-full blur-sm"></div>
          </div>

          {selectedFile ? (
            <div className="space-y-4 relative z-10">
              <div className="flex items-center justify-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <span className="text-lg font-semibold text-green-400">
                  File Selected Successfully!
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center shadow-lg">
                    {getFileIcon()}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-white text-lg">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">
                      {getFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              </div>
              {isProcessing && (
                <div className="flex items-center justify-center space-x-3 text-purple-600 bg-purple-50 rounded-xl p-4">
                  <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="font-medium">Processing your resume...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-3xl flex items-center justify-center mx-auto shadow-lg">
                {getFileIcon()}
              </div>
              <div>
                <p className="text-xl font-semibold text-white mb-2">
                  {isDragOver
                    ? "Drop your resume here"
                    : "Drag and drop your resume"}
                </p>
                <p className="text-gray-300 mb-6">
                  or click the button below to browse
                </p>
                <Button
                  onClick={() => document.getElementById("file-input")?.click()}
                  disabled={isProcessing}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                >
                  <Sparkles className="h-5 w-5 mr-2" />
                  Choose File
                </Button>
                <input
                  id="file-input"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={isProcessing}
                />
              </div>

              {/* File type info + credit cost */}
              <div className="flex items-center justify-center gap-3 text-sm text-gray-300">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span>PDF only &middot; max 10MB</span>
                </div>
                <CreditBadge cost={CREDIT_COST.basic} />
              </div>
            </div>
          )}
        </div>

        {fileError && (
          <p className="mt-4 text-center text-sm text-red-400">{fileError}</p>
        )}

        {selectedFile && !isProcessing && (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={() => {
                setSelectedFile(null);
                const input = document.getElementById(
                  "file-input"
                ) as HTMLInputElement;
                if (input) input.value = "";
              }}
              variant="outline"
              size="sm"
              className="text-sm border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            >
              Choose Different File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
