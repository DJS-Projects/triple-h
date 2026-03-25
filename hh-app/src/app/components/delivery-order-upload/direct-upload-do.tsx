"use client";

import React, { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/app/components/button";
import { Card, CardContent } from "@/app/components/card";
import axios from "axios";

interface ParsedDOInfo {
  status: string;
  parsed_info: Record<string, any>;
  file_id: string;
  file_hash: string;
  file_metadata: Record<string, any>;
  chunks_indexed: number;
  message?: string;
}

interface DirectUploadDOProps {
  onFileUpload: (file: File, parsedInfo?: ParsedDOInfo) => void;
  onClose: () => void;
  isOpen: boolean;
}

const DirectUploadDO: React.FC<DirectUploadDOProps> = ({
  onFileUpload,
  onClose,
  isOpen,
}) => {
  const [doFile, setDOFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<ParsedDOInfo | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setDOFile(file);
    }
  };

  const handleUpload = async () => {
    if (!doFile) {
      alert("Please upload a file first.");
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", doFile);

    try {
      console.log("🚀 Uploading file to http://localhost:8002/upload_pdf");
      console.log("📄 File:", doFile.name, "Size:", doFile.size);

      const response = await axios.post<ParsedDOInfo>(
        "http://localhost:8002/upload_pdf",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 600000, // 10 minute timeout for large files
        }
      );

      console.log("✅ Response received:", response.data);

      if (response.data.status === "ok") {
        console.log("✅ Upload successful!");
        setParsedInfo(response.data);
        // Call the onFileUpload callback with both file and parsed info
        onFileUpload(doFile, response.data);
        // Close the modal after successful upload
        onClose();
      } else {
        console.error("❌ Upload failed:", response.data.message);
        alert("Error: " + (response.data.message || "Unknown error"));
      }
    } catch (err: any) {
      console.error("❌ Upload error:", err);
      
      if (err.code === "ECONNABORTED") {
        alert("Request timeout - file processing took too long. Please try with a smaller file or check backend.");
      } else if (err.message === "Network Error") {
        alert("Network error: Cannot connect to backend at localhost:8002. Is the backend running? Try: uvicorn do_extract:app --reload --port 8002");
      } else {
        alert("Something went wrong: " + (err.response?.data?.message || err.message));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setDOFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#3a4043]">Upload Delivery Order</h3>
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
            {!doFile ? (
              <div className="border-2 border-dashed border-[#d8d4f0] bg-gray-50 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <div className="space-y-2">
                  <p className="text-[#3a4043]">Upload a delivery order</p>
                  <p className="text-sm text-gray-600">
                    Supported formats: PDF (Max 10MB)
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports both scanned and digital documents with OCR
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="direct-do-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border border-gray-300 text-[#3a4043]"
                    onClick={() =>
                      document.getElementById("direct-do-upload")?.click()
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
                    <p className="text-sm font-medium text-green-800">{doFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(doFile.size / 1024 / 1024).toFixed(2)} MB
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
                    className="flex-1 bg-[#635bff] hover:bg-[#635bff]/90 text-white"
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

export default DirectUploadDO;
