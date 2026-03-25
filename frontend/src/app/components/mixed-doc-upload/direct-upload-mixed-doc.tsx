"use client";

import React, { useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Button } from "@/app/components/button";
import { Card, CardContent } from "@/app/components/card";
import axios from "axios";

interface ParsedMixedDocInfo {
  status: string;
  parsed_info: Record<string, any>;
  document_analysis: {
    detected_types: string[];
    is_mixed: boolean;
  };
  model_used: string;
  ocr_model?: string;
  ocr_model_name?: string;
  confidence_score?: number;
  token_usage: {
    input_tokens: number;
    output_tokens: number;
  };
  processing_time: number;
  file_id: string;
  file_hash: string;
  file_metadata: Record<string, any>;
  chunks_indexed: number;
  message?: string;
}

interface DirectUploadMixedDocProps {
  onFileUpload: (file: File, parsedInfo?: ParsedMixedDocInfo) => void;
  onClose: () => void;
  isOpen: boolean;
}

const LOCAL_MODELS = [
  "gpt-oss:20b",
  "gemma3",
  "gemma3:27b",
  "llama3.1",
  "llama3.2",
  "nemotron-3-nano:30b",
  "qwen3",
  "deepseek-r1",
  "deepseek-r1:32b",
];

const CLOUD_MODELS = [
  "gemma-3-27b-it",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-3-flash-preview",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash-lite",
  "gemma-3-12b-it",
  "gemini-3-pro-preview",
];

const DirectUploadMixedDoc: React.FC<DirectUploadMixedDocProps> = ({
  onFileUpload,
  onClose,
  isOpen,
}) => {
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>("local");
  const [selectedModel, setSelectedModel] = useState<string>("gpt-oss:20b");
  const [selectedOcrModel, setSelectedOcrModel] = useState<string>("3");
  const [confidenceScore, setConfidenceScore] = useState<number>(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parsedInfo, setParsedInfo] = useState<ParsedMixedDocInfo | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setDocFile(file);
    }
  };

  // Update model when provider changes
  React.useEffect(() => {
    if (selectedProvider === "local") {
      setSelectedModel(LOCAL_MODELS[0]);
    } else {
      setSelectedModel(CLOUD_MODELS[0]);
    }
  }, [selectedProvider]);

  const handleUpload = async () => {
    if (!docFile) {
      alert("Please upload a file first.");
      return;
    }

    setIsProcessing(true);
    const formData = new FormData();
    formData.append("file", docFile);
    formData.append("provider", selectedProvider);
    formData.append("model", selectedModel);
    formData.append("ocr_model", selectedOcrModel);
    formData.append("confidence_score", confidenceScore.toString());

    try {
      console.log("🚀 Uploading file to http://localhost:8002/upload_pdf");
      console.log("📄 File:", docFile.name, "Size:", docFile.size);
      console.log("🔌 Provider:", selectedProvider);
      console.log("🤖 Model:", selectedModel);
      console.log("📖 OCR Model:", selectedOcrModel === "1" ? "PaddleOCR" : selectedOcrModel === "2" ? "Tesseract" : "PP-Structure");
      console.log("🎯 Confidence Score:", confidenceScore + "%");

      const response = await axios.post<ParsedMixedDocInfo>(
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
        console.log("📊 Model used:", response.data.model_used);
        console.log("📖 Reading Model used:", response.data.ocr_model_name || "Unknown");
        console.log("🎯 Confidence Score used:", response.data.confidence_score + "%");
        console.log("⏱️  Processing time:", response.data.processing_time, "seconds");
        setParsedInfo(response.data);
        // Call the onFileUpload callback with both file and parsed info
        onFileUpload(docFile, response.data);
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
        alert("Network error: Cannot connect to backend at localhost:8002. Is the backend running? Try: uvicorn mixed_extract:app --reload --port 8002");
      } else {
        alert("Something went wrong: " + (err.response?.data?.message || err.message));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveFile = () => {
    setDocFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-[#3a4043]">Upload Document</h3>
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
            {/* Provider Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
              >
                <option value="local">Local (Ollama)</option>
                <option value="cloud">Cloud (Google AI)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedProvider === "local" && "Process documents using local Ollama models (requires Ollama installed)"}
                {selectedProvider === "cloud" && "Process documents using Google's cloud AI models"}
              </p>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select AI Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
              >
                {(selectedProvider === "local" ? LOCAL_MODELS : CLOUD_MODELS).map((modelName) => (
                  <option key={modelName} value={modelName}>
                    {modelName}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedProvider === "local" && "Local Ollama models for offline processing"}
                {selectedProvider === "cloud" && selectedModel === "gemini-2.0-flash" && "Fast and efficient, good for general tasks"}
                {selectedProvider === "cloud" && selectedModel === "gemini-2.5-flash" && "Improved version with better accuracy"}
                {selectedProvider === "cloud" && selectedModel === "gemini-2.0-flash-lite" && "Lightweight model for quick processing"}
                {selectedProvider === "cloud" && selectedModel === "gemini-2.5-flash-lite" && "Lightweight with improved accuracy"}
                {selectedProvider === "cloud" && selectedModel === "gemma-3-12b-it" && "12B parameter model, good balance"}
                {selectedProvider === "cloud" && selectedModel === "gemma-3-27b-it" && "27B parameter model, more powerful"}
                {selectedProvider === "cloud" && selectedModel === "gemini-3-pro-preview" && "Latest Pro preview model"}
              </p>
            </div>

            {/* OCR Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reading Model (OCR)
              </label>
              <select
                value={selectedOcrModel}
                onChange={(e) => setSelectedOcrModel(e.target.value)}
                disabled={isProcessing}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] disabled:bg-gray-100 disabled:cursor-not-allowed text-sm"
              >
                <option value="1">Model 1 - PaddleOCR</option>
                <option value="2">Model 2 - Tesseract</option>
                <option value="3">Model 3 - PaddleOCR PP-Structure</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedOcrModel === "1" && "PaddleOCR: Better for handwritten text and complex layouts"}
                {selectedOcrModel === "2" && "Tesseract: Reliable for printed text"}
                {selectedOcrModel === "3" && "PP-Structure: Advanced layout analysis and document structure extraction"}
              </p>
            </div>

            {/* Confidence Score Slider */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Handwriting Confidence Score: {confidenceScore}%
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={confidenceScore}
                onChange={(e) => setConfidenceScore(parseInt(e.target.value))}
                disabled={isProcessing}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:bg-gray-100 disabled:cursor-not-allowed accent-[#635bff]"
              />
              <p className="text-xs text-gray-500 mt-1">
                Filters text below this confidence threshold (higher = stricter filtering)
              </p>
            </div>

            {!docFile ? (
              <div className="border-2 border-dashed border-[#d8d4f0] bg-gray-50 rounded-lg p-6 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                <div className="space-y-2">
                  <p className="text-[#3a4043]">Upload a document</p>
                  <p className="text-sm text-gray-600">
                    Supported formats: PDF (Max 10MB)
                  </p>
                  <p className="text-xs text-gray-500">
                    Delivery Orders, Invoices, Weighing Bills, or mixed documents
                  </p>
                  <p className="text-xs text-gray-500">
                    Supports both scanned and digital documents with OCR
                  </p>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="direct-mixed-doc-upload"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border border-gray-300 text-[#3a4043]"
                    onClick={() =>
                      document.getElementById("direct-mixed-doc-upload")?.click()
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
                    <p className="text-sm font-medium text-green-800">{docFile.name}</p>
                    <p className="text-xs text-green-600">
                      {(docFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemoveFile}
                    className="text-red-500 hover:text-red-700"
                    disabled={isProcessing}
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
                    disabled={isProcessing}
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

export default DirectUploadMixedDoc;
