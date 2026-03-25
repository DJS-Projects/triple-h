"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/card";
import { AlertCircle, CheckCircle2, FileText, FileImage, File, Upload, Loader2, Eye, X } from "lucide-react";
import { normalizeDeliveryOrderData, ensureArray, normalizeResponseStructure } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/app/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/select";

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

interface MixedDocumentData {
  document_analysis?: {
    detected_types: string[];
    is_mixed: boolean;
  };
  model_used?: string;
  ocr_model?: string;
  ocr_model_name?: string;
  confidence_score?: number;
  token_usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  processing_time?: number;
  delivery_order_data?: {
    "D/O issuer name"?: string;
    "sold to"?: string;
    "sold to (address)"?: string;
    "delivered to"?: string;
    "delivered to (address)"?: string;
    "D/O number"?: string[];
    "P/O number"?: string[];
    "Vehicle number"?: string[];
    "date"?: string[];
    "items"?: Array<{
      description: string;
      quantity: string;
      weight_mt?: string;
    }>;
    "total_quantity"?: string;
    "total_weight_mt"?: string;
    "good description"?: string[];
    "quantity"?: string[];
  };
  weighing_bill_data?: {
    weighing_no?: string;
    contract_no?: string;
    vehicle_no?: string;
    gross_weight?: string;
    tare_weight?: string;
    net_weight?: string;
    off_weight?: string;
    actual_weight?: string;
    gross_time?: string;
  };
  invoice_data?: {
    invoice_number?: string;
    invoice_date?: string;
    bill_to?: string;
    ship_to?: string;
    items?: Array<{
      description: string;
      quantity: string;
      unit_price: string;
      amount: string;
    }>;
    subtotal?: string;
    tax?: string;
    total?: string;
  };
}

interface UploadedFile {
  id: string;
  file: File;
  fileName: string;
  fileType: string;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  data?: MixedDocumentData;
  error?: string;
  fileUrl?: string;
}

export default function MixedDocumentsPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  
  // Upload options state
  const [aiProvider, setAiProvider] = useState("local");
  const [aiModel, setAiModel] = useState(LOCAL_MODELS[0]);
  const [readingModel, setReadingModel] = useState("model3");
  const [confidenceScore, setConfidenceScore] = useState([90]);

  // Column widths state for resizable layout
  const [leftWidth, setLeftWidth] = useState(25); // percentage
  const [centerWidth, setCenterWidth] = useState(50); // percentage
  const [resizing, setResizing] = useState<null | "left" | "center">(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Form state for the selected document
  const [formDescription, setFormDescription] = useState("");
  const [formTotalWeight, setFormTotalWeight] = useState("");
  const [checkedFileIds, setCheckedFileIds] = useState<Set<string>>(new Set());
  const [combinedDescription, setCombinedDescription] = useState("");
  const [descriptionByFileId, setDescriptionByFileId] = useState<Map<string, string>>(new Map());

  const selectedFile = uploadedFiles.find(f => f.id === selectedFileId);

  // Update model when provider changes
  useEffect(() => {
    if (aiProvider === "local") {
      setAiModel(LOCAL_MODELS[0]);
    } else {
      setAiModel(CLOUD_MODELS[0]);
    }
  }, [aiProvider]);

  // Process files one at a time - queue system
  useEffect(() => {
    const processPendingFile = async () => {
      // Only process if not already processing
      if (isProcessingFile) return;
      
      // Find the first pending file
      const pendingFile = uploadedFiles.find(f => f.status === "pending");
      
      if (pendingFile) {
        setIsProcessingFile(true);
        await processFile(pendingFile);
        setIsProcessingFile(false);
      }
    };

    processPendingFile();
  }, [uploadedFiles, isProcessingFile]);

  // Handle mouse move for resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const totalWidth = rect.width;
      const percentage = (newX / totalWidth) * 100;

      if (resizing === "left") {
        // Adjust left column width (min 15%, max 40%)
        const newLeftWidth = Math.max(15, Math.min(40, percentage));
        setLeftWidth(newLeftWidth);
        setCenterWidth(Math.max(20, 100 - newLeftWidth - (100 - leftWidth - centerWidth)));
      } else if (resizing === "center") {
        // Adjust center column width
        const currentRightWidth = 100 - leftWidth - centerWidth;
        const newCenterStart = leftWidth;
        const newCenterWidth = percentage - newCenterStart;
        
        // Center must be at least 20%, and right must be at least 15%
        if (newCenterWidth >= 20 && percentage <= 85) {
          setCenterWidth(newCenterWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    if (resizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [resizing, leftWidth, centerWidth]);

  // Get file icon based on file type
  const getFileIcon = (fileType: string) => {
    if (fileType === "pdf") return <FileText className="h-5 w-5 text-red-500" />;
    if (fileType === "image") return <FileImage className="h-5 w-5 text-blue-500" />;
    if (fileType === "doc") return <File className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  // Handle file selection from dialog
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setSelectedFiles(Array.from(files));
  };

  // Handle confirming upload from dialog
  const handleConfirmUpload = () => {
    if (selectedFiles.length === 0) return;

    const newFiles: UploadedFile[] = selectedFiles.map(file => {
      const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
      let fileType = "other";
      
      if (fileExtension === "pdf") fileType = "pdf";
      else if (["jpg", "jpeg", "png", "gif", "bmp"].includes(fileExtension)) fileType = "image";
      else if (["doc", "docx"].includes(fileExtension)) fileType = "doc";

      return {
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        fileType,
        status: "pending",
        fileUrl: URL.createObjectURL(file)
      };
    });

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setSelectedFiles([]);
    setIsDialogOpen(false);
    
    // Files will be processed by the useEffect queue system
  };

  // Remove a file from selected files in dialog
  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Remove a file from uploaded files list
  const handleDeleteUploadedFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
    if (selectedFileId === fileId) {
      setSelectedFileId(null);
    }
  };

  // Process a single file
  const processFile = async (fileObj: UploadedFile) => {
    // Update status to uploading
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileObj.id ? { ...f, status: "uploading" as const } : f
    ));

    try {
      const formData = new FormData();
      formData.append("file", fileObj.file);
      
      // Add configuration options from dialog
      formData.append("provider", aiProvider);
      formData.append("model", aiModel);
      
      // Convert reading model format: model1->1, model2->2, model3->3
      const ocrModelNumber = readingModel.replace("model", "");
      formData.append("ocr_model", ocrModelNumber);
      
      formData.append("confidence_score", confidenceScore[0].toString());

      // Update to processing
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: "processing" as const } : f
      ));

      const response = await fetch("http://localhost:8001/upload_pdf", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const result = await response.json();
      
      console.log('Raw result from backend:', result);
      
      // First normalize the response structure to handle both formats
      let normalizedStructure = normalizeResponseStructure(result.parsed_info);
      
      console.log('After normalizeResponseStructure:', normalizedStructure);
      
      // Then normalize the delivery order data (field names, arrays, etc.)
      if (normalizedStructure.delivery_order_data) {
        normalizedStructure.delivery_order_data = normalizeDeliveryOrderData(normalizedStructure.delivery_order_data);
        console.log('After normalizeDeliveryOrderData:', normalizedStructure.delivery_order_data);
      }
      
      const normalizedData: any = {
        ...normalizedStructure,
        document_analysis: result.document_analysis,
        model_used: result.model_used,
        ocr_model: result.ocr_model,
        ocr_model_name: result.ocr_model_name,
        confidence_score: result.confidence_score,
        token_usage: result.token_usage,
        processing_time: result.processing_time,
      };

      // Update file with processed data
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: "complete" as const, data: normalizedData } : f
      ));

    } catch (error) {
      console.error("Error processing file:", error);
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileObj.id ? { ...f, status: "error" as const, error: "Processing failed" } : f
      ));
    }
  };

  // Handle file click - show details
  const handleFileClick = (fileId: string) => {
    setSelectedFileId(fileId);
    const file = uploadedFiles.find(f => f.id === fileId);
    if (file && file.data) {
      updateFormFromData(file.data);
    }
  };

  // Handle checkbox change for combined description
  const handleCheckboxChange = (fileId: string, checked: boolean) => {
    const newCheckedIds = new Set(checkedFileIds);
    const newDescriptionMap = new Map(descriptionByFileId);
    
    if (checked) {
      newCheckedIds.add(fileId);
      // Generate fresh description for newly checked file if not already stored
      if (!newDescriptionMap.has(fileId)) {
        const file = uploadedFiles.find(f => f.id === fileId);
        if (file && file.data) {
          const freshDescription = generateSingleFileDescription(file.data);
          newDescriptionMap.set(fileId, freshDescription);
        }
      }
    } else {
      newCheckedIds.delete(fileId);
      // Remove the description for unchecked file
      newDescriptionMap.delete(fileId);
    }
    
    setCheckedFileIds(newCheckedIds);
    setDescriptionByFileId(newDescriptionMap);
    updateCombinedDescription(newCheckedIds, newDescriptionMap);
  };

  // Generate description for a single file
  const generateSingleFileDescription = (data: MixedDocumentData): string => {
    const lines: string[] = [];
    
    // Delivered Date
    if (data.delivery_order_data?.['date'] && Array.isArray(data.delivery_order_data['date']) && data.delivery_order_data['date'].length > 0) {
      const date = data.delivery_order_data['date'][0];
      lines.push(`ORIGINAL DELIVERED DATE: ${date}`);
    }
    
    // D/O Issuer Name and D/O Number
    if (data.delivery_order_data?.['D/O issuer name'] || (data.delivery_order_data?.['D/O number'] && data.delivery_order_data['D/O number'].length > 0)) {
      const issuerName = data.delivery_order_data['D/O issuer name'] || '';
      const doNumber = data.delivery_order_data['D/O number']?.[0] || '';
      lines.push(`${issuerName} D/O: ${doNumber}`.trim());
    }
    
    // Contract Number
    if (data.weighing_bill_data?.['contract_no']) {
      lines.push(`CONTRACT NO: ${data.weighing_bill_data['contract_no']}`);
    }
    
    // Vehicle Number
    const vehicleNo = data.weighing_bill_data?.['vehicle_no'] || 
                  (data.delivery_order_data?.['Vehicle number'] && data.delivery_order_data['Vehicle number'].length > 0 
                  ? data.delivery_order_data['Vehicle number'][0] 
                  : '');
    lines.push(`VEHICLE NO: ${vehicleNo || ''}`);
    
    // Calculate total weight in KG
    let weightInMT = 0;
    if (data.weighing_bill_data?.['actual_weight']) {
      const match = data.weighing_bill_data['actual_weight'].match(/([0-9.]+)/);
      if (match) {
        weightInMT = parseFloat(match[1]);
      }
    } else if (data.delivery_order_data?.['total_weight_mt']) {
      weightInMT = parseFloat(data.delivery_order_data['total_weight_mt']);
    }
    
    const weightInKG = weightInMT * 1000;
    lines.push(`TOTAL WEIGHT (KG): ${weightInKG > 0 ? weightInKG.toFixed(2) : ''}`);
    
    return lines.join('\n');
  };

  // Update combined description
  const updateCombinedDescription = (checkedIds: Set<string>, descMap: Map<string, string>) => {
    const descriptions: string[] = [];
    
    // Iterate through checked file IDs in order
    checkedIds.forEach(fileId => {
      // Use stored description if available, otherwise generate fresh
      if (descMap.has(fileId)) {
        descriptions.push(descMap.get(fileId)!);
      } else {
        const file = uploadedFiles.find(f => f.id === fileId);
        if (file && file.data) {
          descriptions.push(generateSingleFileDescription(file.data));
        }
      }
    });
    
    setCombinedDescription(descriptions.join('\n\n'));
  };

  // Handle combined description text change - update descriptions per file
  const handleCombinedDescriptionChange = (text: string) => {
    setCombinedDescription(text);
    
    // Split by '\n\n' to identify each document section
    const sections = text.split('\n\n');
    const checkedIdsArray = Array.from(checkedFileIds);
    
    // Update the descriptions map with the edited sections
    const newDescriptionMap = new Map(descriptionByFileId);
    sections.forEach((section, index) => {
      if (index < checkedIdsArray.length && section.trim()) {
        newDescriptionMap.set(checkedIdsArray[index], section);
      }
    });
    
    setDescriptionByFileId(newDescriptionMap);
  };

  // Handle file double click - open in new tab
  const handleFileDoubleClick = (fileUrl: string) => {
    window.open(fileUrl, '_blank');
  };

  // Update form from document data
  const updateFormFromData = (data: MixedDocumentData) => {
    const lines: string[] = [];
    
    // Delivered Date
    if (data.delivery_order_data?.["date"] && Array.isArray(data.delivery_order_data["date"]) && data.delivery_order_data["date"].length > 0) {
      const date = data.delivery_order_data["date"][0];
      lines.push(`ORIGINAL DELIVERED DATE: ${date}`);
    }
    
    // Invoice Number
    if (data.invoice_data?.["invoice_number"]) {
      lines.push(`INVOICE NO: ${data.invoice_data["invoice_number"]}`);
    }
    
    // Invoice Date
    if (data.invoice_data?.["invoice_date"]) {
      lines.push(`INVOICE DATE: ${data.invoice_data["invoice_date"]}`);
    }
    
    // D/O Issuer Name and D/O Number
    if (data.delivery_order_data?.["D/O issuer name"] || (data.delivery_order_data?.["D/O number"] && data.delivery_order_data["D/O number"].length > 0)) {
      const issuerName = data.delivery_order_data["D/O issuer name"] || "";
      const doNumber = data.delivery_order_data["D/O number"]?.[0] || "";
      lines.push(`${issuerName} D/O: ${doNumber}`.trim());
    }
    
    // Contract Number
    if (data.weighing_bill_data?.["contract_no"]) {
      lines.push(`CONTRACT NO: ${data.weighing_bill_data["contract_no"]}`);
    }
    
    // Vehicle Number
    const vehicleNo = data.weighing_bill_data?.["vehicle_no"] || 
                  (data.delivery_order_data?.["Vehicle number"] && data.delivery_order_data["Vehicle number"].length > 0 
                  ? data.delivery_order_data["Vehicle number"][0] 
                  : ""); // Fallback to an empty string instead of null

    // Push the line regardless, using a placeholder if vehicleNo is empty
      lines.push(`VEHICLE NO: ${vehicleNo || ""}`);
    
    // Calculate total weight in KG
    let weightInMT = 0;
    if (data.weighing_bill_data?.["actual_weight"]) {
      const match = data.weighing_bill_data["actual_weight"].match(/([0-9.]+)/);
      if (match) {
        weightInMT = parseFloat(match[1]);
      }
    } else if (data.delivery_order_data?.["total_weight_mt"]) {
      weightInMT = parseFloat(data.delivery_order_data["total_weight_mt"]);
    }
    
    const weightInKG = weightInMT * 1000;
    setFormTotalWeight(weightInKG > 0 ? weightInKG.toFixed(2) : "");
    
    // Add total weight to description textbox
    lines.push(`TOTAL WEIGHT (KG): ${weightInKG > 0 ? weightInKG.toFixed(2) : ""}`);
    
    setFormDescription(lines.join('\n'));
  };

  // Handle form submit
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting form:", {
      fileId: selectedFileId,
      description: formDescription,
      totalWeight: formTotalWeight
    });
    // TODO: Add submit logic here
  };

  // Get status badge  
  const getStatusBadge = (status: UploadedFile["status"]) => {
    switch (status) {
      case "pending":
        return <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">Pending</span>;
      case "uploading":
        return <span className="text-xs px-2 py-1 bg-blue-200 text-blue-700 rounded flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Uploading</span>;
      case "processing":
        return <span className="text-xs px-2 py-1 bg-yellow-200 text-yellow-700 rounded flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Processing</span>;
      case "complete":
        return <span className="text-xs px-2 py-1 bg-green-200 text-green-700 rounded">Complete</span>;
      case "error":
        return <span className="text-xs px-2 py-1 bg-red-200 text-red-700 rounded">Error</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-[#006DAE] mb-2">
            Multi-Document Processing
          </h1>
          <p className="text-gray-600">
            Upload multiple documents for AI processing.
          </p>
        </div>

        {/* 3-Column Layout */}
        <div ref={containerRef} className="flex gap-0 h-[calc(100vh-100px)]">
          
          {/* LEFT COLUMN - File List */}
          <div style={{ width: `${leftWidth}%` }} className="flex flex-col gap-4 h-full overflow-y-auto">
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Documents</CardTitle>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <Button
                  onClick={() => setIsDialogOpen(true)}
                  className="w-full"
                  disabled={isUploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Documents
                </Button>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-3">
                {uploadedFiles.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No documents uploaded</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {uploadedFiles.map((file) => (
                      <div
                        key={file.id}
                        className={`p-2 border rounded-lg transition-all hover:shadow-md ${
                          selectedFileId === file.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div 
                            className="flex-1 cursor-pointer min-w-0"
                            onClick={() => handleFileClick(file.id)}
                            onDoubleClick={() => file.fileUrl && handleFileDoubleClick(file.fileUrl)}
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-shrink-0">
                                {getFileIcon(file.fileType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-gray-900 break-words" title={file.fileName}>
                                  {file.fileName}
                                </p>
                                <div className="mt-1">
                                  {getStatusBadge(file.status)}
                                </div>
                                {file.error && (
                                  <p className="text-xs text-red-600 mt-1">{file.error}</p>
                                )}
                                {file.status === "complete" && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={checkedFileIds.has(file.id)}
                                      onChange={(e) => handleCheckboxChange(file.id, e.target.checked)}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label className="text-xs text-gray-600 cursor-pointer">
                                      Include
                                    </label>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUploadedFile(file.id)}
                            className="text-red-500 hover:text-red-700 flex-shrink-0 h-6 w-6 p-0"
                            disabled={file.status === "uploading" || file.status === "processing"}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* DIVIDER - Left/Center */}
          <div
            onMouseDown={() => setResizing("left")}
            className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors"
            title="Drag to resize columns"
          />

          {/* CENTER COLUMN - Document Details */}
          <div style={{ width: `${centerWidth}%` }} className="h-full overflow-y-auto">
            <Card className="h-full overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Document Details</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {!selectedFile ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Eye className="h-16 w-16 mb-4 opacity-50" />
                    <p className="text-lg font-medium">No document selected</p>
                    <p className="text-sm">Click on a document to view details</p>
                  </div>
                ) : selectedFile.status !== "complete" ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Loader2 className="h-16 w-16 mb-4 opacity-50 animate-spin" />
                    <p className="text-lg font-medium">Processing document...</p>
                    <p className="text-sm">Please wait</p>
                  </div>
                ) : selectedFile.data ? (
                  <div className="space-y-6">
                    {/* Summary Section */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                        Summary
                      </h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {/* Delivered Date */}
                        {selectedFile.data.delivery_order_data?.["date"] && Array.isArray(selectedFile.data.delivery_order_data["date"]) && selectedFile.data.delivery_order_data["date"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Delivered Date
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.delivery_order_data["date"][0]}
                            </p>
                          </div>
                        )}

                        {/* Invoice No */}
                        {selectedFile.data.invoice_data?.["invoice_number"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Invoice No
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.invoice_data["invoice_number"]}
                            </p>
                          </div>
                        )}

                        {/* Invoice Date */}
                        {selectedFile.data.invoice_data?.["invoice_date"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Invoice Date
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.invoice_data["invoice_date"]}
                            </p>
                          </div>
                        )}

                        {/* D/O Issuer Name */}
                        {selectedFile.data.delivery_order_data?.["D/O issuer name"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              D/O Issuer Name
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.delivery_order_data["D/O issuer name"]}
                            </p>
                          </div>
                        )}

                        {/* D/O Number */}
                        {selectedFile.data.delivery_order_data?.["D/O number"] && selectedFile.data.delivery_order_data["D/O number"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              D/O Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.delivery_order_data["D/O number"].join(", ")}
                            </p>
                          </div>
                        )}

                        {/* P/O Number */}
                        {selectedFile.data.delivery_order_data?.["P/O number"] && selectedFile.data.delivery_order_data["P/O number"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              P/O Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.delivery_order_data["P/O number"].join(", ")}
                            </p>
                          </div>
                        )}

                        {/* Contract No */}
                        {selectedFile.data.weighing_bill_data?.["contract_no"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Contract No
                            </p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.weighing_bill_data["contract_no"]}
                            </p>
                          </div>
                        )}

                        {/* Vehicle Number */}
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Vehicle No
                          </p>
                          <p className="text-sm text-gray-800">
                            {selectedFile.data.weighing_bill_data?.["vehicle_no"] 
                              ? selectedFile.data.weighing_bill_data["vehicle_no"]
                              : selectedFile.data.delivery_order_data?.["Vehicle number"] && selectedFile.data.delivery_order_data["Vehicle number"].length > 0
                              ? selectedFile.data.delivery_order_data["Vehicle number"].join(", ")
                              : "-"
                            }
                          </p>
                        </div>

                        {/* Total Weight */}
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Total Weight
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {(() => {
                              // Priority 1: Use weighing bill actual_weight if available
                              if (selectedFile.data.weighing_bill_data?.["actual_weight"]) {
                                const weight = selectedFile.data.weighing_bill_data["actual_weight"];
                                // Extract numeric value if it contains unit (e.g., "28.21 t")
                                const match = weight.match(/([0-9.]+)/);
                                if (match) {
                                  return `${parseFloat(match[1]).toFixed(4)} MT`;
                                }
                                return weight;
                              }
                              // Priority 2: Use delivery order total_weight_mt
                              if (selectedFile.data.delivery_order_data?.["total_weight_mt"]) {
                                return `${parseFloat(selectedFile.data.delivery_order_data["total_weight_mt"]).toFixed(4)} MT`;
                              }
                              // Priority 3: Calculate from items if available
                              if (selectedFile.data.delivery_order_data?.["items"] && Array.isArray(selectedFile.data.delivery_order_data["items"])) {
                                const totalWeight = selectedFile.data.delivery_order_data["items"].reduce((sum, item) => {
                                  if (item.weight_mt) {
                                    return sum + parseFloat(item.weight_mt);
                                  }
                                  return sum;
                                }, 0);
                                if (totalWeight > 0) {
                                  return `${totalWeight.toFixed(4)} MT`;
                                }
                              }
                              return "-";
                            })()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Processing Metrics Summary */}
                    {(selectedFile.data.model_used || selectedFile.data.processing_time || selectedFile.data.ocr_model_name || selectedFile.data.confidence_score !== undefined) && (
                      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Processing Metrics Summary</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {selectedFile.data.model_used && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Model</p>
                              <p className="text-xs font-mono text-gray-800 break-words">{selectedFile.data.model_used}</p>
                            </div>
                          )}
                          {selectedFile.data.ocr_model_name && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reading Model</p>
                              <p className="text-xs font-mono text-gray-800">{selectedFile.data.ocr_model_name}</p>
                            </div>
                          )}
                          {selectedFile.data.confidence_score !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Confidence</p>
                              <p className="text-xs font-mono text-gray-800">{selectedFile.data.confidence_score}%</p>
                            </div>
                          )}
                          {selectedFile.data.processing_time !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time</p>
                              <p className="text-xs font-mono text-gray-800">{selectedFile.data.processing_time}s</p>
                            </div>
                          )}
                          {selectedFile.data.token_usage && (
                            <>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Input Tokens</p>
                                <p className="text-xs font-mono text-gray-800">{selectedFile.data.token_usage.input_tokens}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Output Tokens</p>
                                <p className="text-xs font-mono text-gray-800">{selectedFile.data.token_usage.output_tokens}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Delivery Order Information */}
                    {selectedFile.data.delivery_order_data && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Delivery Order Information
                        </h3>
                        
                        {/* DEBUG: Show all fields */}
                        {/* <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs">
                          <p className="font-semibold mb-2">DEBUG - All fields in delivery_order_data:</p>
                          <pre className="whitespace-pre-wrap overflow-auto max-h-40">
                            {JSON.stringify(selectedFile.data.delivery_order_data, null, 2)}
                          </pre>
                        </div> */}
                        
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          {selectedFile.data.delivery_order_data["sold to"] && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Sold To</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.delivery_order_data["sold to"]}</p>
                              {selectedFile.data.delivery_order_data["sold to (address)"] && (
                                <p className="text-xs text-gray-600 mt-1">{selectedFile.data.delivery_order_data["sold to (address)"]}</p>
                              )}
                            </div>
                          )}
                          {selectedFile.data.delivery_order_data["delivered to"] && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Delivered To</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.delivery_order_data["delivered to"]}</p>
                              {selectedFile.data.delivery_order_data["delivered to (address)"] && (
                                <p className="text-xs text-gray-600 mt-1">{selectedFile.data.delivery_order_data["delivered to (address)"]}</p>
                              )}
                            </div>
                          )}
                          {selectedFile.data.delivery_order_data["D/O number"] && selectedFile.data.delivery_order_data["D/O number"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">D/O #</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.delivery_order_data["D/O number"].join(", ")}</p>
                            </div>
                          )}
                          {selectedFile.data.delivery_order_data["P/O number"] && selectedFile.data.delivery_order_data["P/O number"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">P/O #</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.delivery_order_data["P/O number"].join(", ")}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Vehicle No</p>
                            <p className="text-sm text-gray-800">
                              {selectedFile.data.delivery_order_data["Vehicle number"] && selectedFile.data.delivery_order_data["Vehicle number"].length > 0
                                ? selectedFile.data.delivery_order_data["Vehicle number"].join(", ")
                                : "-"
                              }
                            </p>
                          </div>
                          {selectedFile.data.delivery_order_data["date"] && Array.isArray(selectedFile.data.delivery_order_data["date"]) && selectedFile.data.delivery_order_data["date"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Date</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.delivery_order_data["date"].join(", ")}</p>
                            </div>
                          )}

                          {/* Items Table */}
                          {selectedFile.data.delivery_order_data["items"] && Array.isArray(selectedFile.data.delivery_order_data["items"]) && selectedFile.data.delivery_order_data["items"].length > 0 ? (
                            <div className="col-span-2 md:col-span-3">
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">
                                Items
                              </p>
                              <div className="overflow-x-auto">
                                <table className="min-w-full border border-gray-300 text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">#</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Description</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Quantity</th>
                                      <th className="border border-gray-300 px-3 py-2 text-left font-semibold">Weight (MT)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {selectedFile.data.delivery_order_data["items"].map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.description || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.quantity || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.weight_mt ? parseFloat(item.weight_mt).toFixed(4) : "-"}</td>
                                      </tr>
                                    ))}
                                    {/* Total Row */}
                                    {(selectedFile.data.delivery_order_data["total_quantity"] || selectedFile.data.delivery_order_data["total_weight_mt"]) && (
                                      <tr className="bg-blue-50 font-semibold">
                                        <td className="border border-gray-300 px-3 py-2" colSpan={2}>Total</td>
                                        <td className="border border-gray-300 px-3 py-2">{selectedFile.data.delivery_order_data["total_quantity"] || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">
                                          {selectedFile.data.delivery_order_data["total_weight_mt"] ? `${parseFloat(selectedFile.data.delivery_order_data["total_weight_mt"]).toFixed(4)} MT` : "-"}
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Fallback to old format if items array not available */}
                              {selectedFile.data.delivery_order_data["good description"] && Array.isArray(selectedFile.data.delivery_order_data["good description"]) && selectedFile.data.delivery_order_data["good description"].length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase">
                                    Description
                                  </p>
                                  <p className="text-sm text-gray-800">
                                    {selectedFile.data.delivery_order_data["good description"].join(", ")}
                                  </p>
                                </div>
                              )}

                              {/* Quantity */}
                              {selectedFile.data.delivery_order_data["quantity"] && Array.isArray(selectedFile.data.delivery_order_data["quantity"]) && selectedFile.data.delivery_order_data["quantity"].length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase">
                                    Quantity
                                  </p>
                                  <p className="text-sm text-gray-800">
                                    {selectedFile.data.delivery_order_data["quantity"].join(", ")}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Weighing Bill Information */}
                    {selectedFile.data.weighing_bill_data && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Weighing Bill Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          {selectedFile.data.weighing_bill_data.weighing_no && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Weighing No</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.weighing_no}</p>
                            </div>
                          )}
                          {selectedFile.data.weighing_bill_data.contract_no && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Contract No</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.contract_no}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">Vehicle No</p>
                            <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.vehicle_no || "-"}</p>
                          </div>
                          {selectedFile.data.weighing_bill_data.gross_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Gross Weight</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.gross_weight}</p>
                            </div>
                          )}
                          {selectedFile.data.weighing_bill_data.tare_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Tare Weight</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.tare_weight}</p>
                            </div>
                          )}
                          {selectedFile.data.weighing_bill_data.net_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Net Weight</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.net_weight}</p>
                            </div>
                          )}
                          {selectedFile.data.weighing_bill_data.actual_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Actual Weight</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.weighing_bill_data.actual_weight}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Invoice Information */}
                    {selectedFile.data.invoice_data && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Invoice Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          {selectedFile.data.invoice_data.invoice_number && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Invoice #</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.invoice_data.invoice_number}</p>
                            </div>
                          )}
                          {selectedFile.data.invoice_data.invoice_date && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Invoice Date</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.invoice_data.invoice_date}</p>
                            </div>
                          )}
                          {selectedFile.data.invoice_data.bill_to && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Bill To</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.invoice_data.bill_to}</p>
                            </div>
                          )}
                          {selectedFile.data.invoice_data.ship_to && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Ship To</p>
                              <p className="text-sm text-gray-800">{selectedFile.data.invoice_data.ship_to}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Document Preview */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                        Document Preview
                      </h3>
                      <div 
                        onClick={() => selectedFile.fileUrl && window.open(selectedFile.fileUrl, '_blank')}
                        className="cursor-pointer border-2 border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 transition-colors"
                        title="Click to open in new tab"
                      >
                        {selectedFile.fileType === "pdf" ? (
                          <iframe
                            src={`${selectedFile.fileUrl}#navpanes=0`}
                            className="w-full h-[1000px]"
                            title={selectedFile.fileName}
                          />
                        ) : selectedFile.fileType === "image" ? (
                          <img
                            src={selectedFile.fileUrl}
                            alt={selectedFile.fileName}
                            className="w-full h-auto object-contain max-h-[1000px]"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                            <File className="h-16 w-16 mb-3 opacity-50" />
                            <p className="text-sm">Preview not available</p>
                            <p className="text-xs">Click to open in new tab</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* DIVIDER - Center/Right */}
          <div
            onMouseDown={() => setResizing("center")}
            className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize transition-colors"
            title="Drag to resize columns"
          />

          {/* RIGHT COLUMN - Form */}
          <div style={{ width: `${100 - leftWidth - centerWidth}%` }} className="h-full overflow-y-auto">
            <Card className="h-full overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Submission Form</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto">
                {!selectedFile || selectedFile.status !== "complete" ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <FileText className="h-12 w-12 mb-3 opacity-50" />
                    <p className="text-sm text-center">Select a completed document to fill the form</p>
                  </div>
                ) : (
                  <form onSubmit={handleFormSubmit} className="space-y-4">
                    {combinedDescription && (
                      <div>
                        <label htmlFor="combinedDescription" className="block text-sm font-medium text-gray-700 mb-2">
                          Combined Description
                        </label>
                        <textarea
                          id="combinedDescription"
                          name="combinedDescription"
                          rows={22}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                          value={combinedDescription}
                          onChange={(e) => handleCombinedDescriptionChange(e.target.value)}
                          placeholder="Combined descriptions from selected documents..."
                        />
                      </div>
                    )}
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={10}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Document description will appear here..."
                      />
                    </div>

                    <div>
                      <label htmlFor="totalWeight" className="block text-sm font-medium text-gray-700 mb-2">
                        Total Weight (KG)
                      </label>
                      <input
                        type="text"
                        id="totalWeight"
                        name="totalWeight"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        value={formTotalWeight}
                        onChange={(e) => setFormTotalWeight(e.target.value)}
                        placeholder="Total weight in KG"
                      />
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                    >
                      Submit
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Configure processing options before uploading documents
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {/* AI Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <select
                  value={aiProvider}
                  onChange={(e) => setAiProvider(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] text-sm"
                >
                  <option value="local">Local (Ollama)</option>
                  <option value="cloud">Cloud (Google AI)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {aiProvider === "local" ? "Process documents using local Ollama models (requires Ollama installed)" : "Process documents using Google's cloud AI models"}
                </p>
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select AI Model
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] text-sm"
                >
                  {(aiProvider === "local" ? LOCAL_MODELS : CLOUD_MODELS).map((modelName) => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {aiProvider === "local" 
                    ? "Local Ollama models for offline processing" 
                    : "Cloud-based Google Gemini models for online processing"}
                </p>
              </div>

              {/* Reading Model (OCR) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reading Model (OCR)
                </label>
                <select
                  value={readingModel}
                  onChange={(e) => setReadingModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#635bff] text-sm"
                >
                  <option value="model1">Model 1 - PaddleOCR</option>
                  <option value="model2">Model 2 - Tesseract OCR</option>
                  <option value="model3">Model 3 - PaddleOCR PP-Structure</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  PP-Structure: Advanced layout analysis and document structure extraction
                </p>
              </div>

              {/* Confidence Score */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Handwriting Confidence Score: {confidenceScore[0]}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={confidenceScore[0]}
                  onChange={(e) => setConfidenceScore([parseInt(e.target.value)])}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#635bff]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Filters text below this confidence threshold (higher = stricter filtering)
                </p>
              </div>

              {/* File Upload Area */}
              {selectedFiles.length === 0 ? (
                <div className="border-2 border-dashed border-[#d8d4f0] bg-gray-50 rounded-lg p-6 text-center">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border border-gray-300 text-[#3a4043] mt-3"
                      onClick={() => document.getElementById("multi-upload-input")?.click()}
                    >
                      Choose File
                    </Button>                    
                    <p className="text-[#3a4043] font-medium">Upload a document</p>
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
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="multi-upload-input"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-32 overflow-y-auto space-y-2">
                    {selectedFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-green-800 break-words">{file.name}</p>
                          <p className="text-xs text-green-600">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSelectedFile(index)}
                          className="text-red-500 hover:text-red-700 flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleConfirmUpload}
                      className="flex-1 bg-[#635bff] hover:bg-[#635bff]/90 text-white"
                    >
                      Upload & Process
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedFiles([]);
                        setIsDialogOpen(false);
                      }}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
