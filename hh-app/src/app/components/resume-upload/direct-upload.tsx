"use client";

import React, { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/app/components/button";
import { Card, CardContent } from "@/app/components/card";
import axios from "axios";

interface ParsedInfo {
  status: string;
  parsed_info: string;
  candidate_id: string;
  resume_hash: string;
  file_metadata: Record<string, any>;
  message?: string;
}

interface DirectUploadProps {
  onFileUpload: (file: File, parsedInfo?: ParsedInfo) => void;
  onClose: () => void;
  isOpen: boolean;
}

const DirectUpload: React.FC<DirectUploadProps> = ({
  onFileUpload,
  onClose,
  isOpen,
}) => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<ParsedInfo | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setResumeFile(file);
    }
  };


  const handleUpload = async () => {
    if (!resumeFile) {
      alert("Please upload a file first.");
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", resumeFile);

    try {
      const response = await axios.post<ParsedInfo>(
        "http://localhost:8002/upload_pdf",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.status === "ok") {
        setParsedInfo(response.data);
        // Call the onFileUpload callback with both file and parsed info
        onFileUpload(resumeFile, response.data);
        // Close the modal after successful upload
        onClose();
      } else {
        alert("Error: " + (response.data.message || "Unknown error"));
      }
    } catch (err: any) {
      alert("Something went wrong: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setResumeFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#006DAE]">Upload Resume</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-4">
            {!resumeFile ? (
              <div className="border-2 border-dashed border-[#d8d4f0] bg-gray-50 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <div className="space-y-2">
                  <p className="text-[#006DAE]">Upload your resume</p>
                  <p className="text-sm text-gray-600">
                    Supported formats: PDF, DOC, DOCX (Max 5MB)
                  </p>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    className="hidden"
                    id="direct-resume-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border border-gray-300 text-[#006DAE]"
                    onClick={() =>
                      document.getElementById("direct-resume-upload")?.click()
                    }
                  >
                    Choose File
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{resumeFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(resumeFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleUpload}
                    disabled={isProcessing}
                    className="flex-1 bg-[#006DAE] hover:bg-[#00528A] text-white"
                  >
                    {isProcessing ? "Processing..." : "Upload & Process"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DirectUpload;
