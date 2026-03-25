"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/card";
import DOUploadButton from "@/app/components/delivery-order-upload/DOUploadButton";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface DeliveryOrderData {
  "sold to"?: string;
  "sold to (address)"?: string;
  "delivered to"?: string;
  "delivered to (address)"?: string;
  "D/O number"?: string[];
  "P/O number"?: string[];
  "Vehicle number"?: string[];
  "date"?: string[];
  "good description"?: string[];
  "quantity"?: string[];
}

export default function DeliveryOrderUploadPage() {
  const [uploadedDOs, setUploadedDOs] = useState<DeliveryOrderData[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleDOProcessed = (parsedInfo: any) => {
    try {
      if (parsedInfo && parsedInfo.parsed_info) {
        const newDO = parsedInfo.parsed_info;
        setUploadedDOs((prev) => [...prev, newDO]);
        setUploadStatus({
          type: "success",
          message: `Delivery order processed successfully!`,
        });

        // Clear status message after 3 seconds
        setTimeout(() => {
          setUploadStatus({ type: null, message: "" });
        }, 3000);
      }
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: "Failed to process delivery order.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#006DAE] mb-2">
            Delivery Order Management
          </h1>
          <p className="text-gray-600">
            Upload and extract data from delivery order PDFs. Supports both scanned documents and digital PDFs.
          </p>
        </div>

        {/* Status Message */}
        {uploadStatus.type && (
          <Card
            className={`mb-6 border-l-4 ${
              uploadStatus.type === "success"
                ? "border-l-blue-500 bg-blue-50"
                : "border-l-red-500 bg-red-50"
            }`}
          >
            <CardContent className="flex items-start gap-3 pt-6">
              {uploadStatus.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  uploadStatus.type === "success"
                    ? "text-blue-800"
                    : "text-red-800"
                }`}
              >
                {uploadStatus.message}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upload Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Upload New Delivery Order</CardTitle>
            <CardDescription>
              Upload a PDF file to extract delivery order information
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <DOUploadButton
              buttonText="Upload Delivery Order"
              buttonVariant="default"
              onDOProcessed={handleDOProcessed}
            />
          </CardContent>
        </Card>

        {/* Uploaded Orders Section */}
        {uploadedDOs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Processed Delivery Orders</CardTitle>
              <CardDescription>
                {uploadedDOs.length} delivery order{uploadedDOs.length !== 1 ? "s" : ""} processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {uploadedDOs.map((doItem, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {/* Sold To */}
                      {doItem["sold to"] && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Sold To
                          </p>
                          <p className="text-sm text-gray-800">
                            {doItem["sold to"]}
                            {doItem["sold to (address)"]}
                          </p>
                        </div>
                      )}

                      {/* Delivered To */}
                      {doItem["delivered to"] && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Delivered To
                          </p>
                          <p className="text-sm text-gray-800">
                            {doItem["delivered to"]}
                            {doItem["delivered to (address)"]}
                          </p>
                        </div>
                      )}

                      {/* D/O Numbers */}
                      {doItem["D/O number"] && doItem["D/O number"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            D/O #
                          </p>
                          <p className="text-sm text-gray-800">
                            {Array.isArray(doItem["D/O number"])
                              ? doItem["D/O number"][0]
                              : doItem["D/O number"]}
                          </p>
                        </div>
                      )}
                      {/* P/O Numbers */}
                      {doItem["P/O number"] && doItem["P/O number"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            P/O #
                          </p>
                          <p className="text-sm text-gray-800">
                            {Array.isArray(doItem["P/O number"])
                              ? doItem["P/O number"][0]
                              : doItem["P/O number"]}
                          </p>
                        </div>
                      )}                      
                      {/* Vehicle Numbers */}
                      {doItem["Vehicle number"] && doItem["Vehicle number"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Vehicle #
                          </p>
                          <p className="text-sm text-gray-800">
                            {Array.isArray(doItem["Vehicle number"])
                              ? doItem["Vehicle number"][0]
                              : doItem["Vehicle number"]}
                          </p>
                        </div>
                      )}
                      {/* Dates */}
                      {doItem["date"] && doItem["date"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Date
                          </p>
                          <p className="text-sm text-gray-800">
                            {Array.isArray(doItem["date"])
                              ? doItem["date"][0]
                              : doItem["date"]}
                          </p>
                        </div>
                      )}

                      {/* Good Description */}
                      {doItem["good description"] && doItem["good description"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Description
                          </p>
                          <p className="text-sm text-gray-800 truncate">
                            {Array.isArray(doItem["good description"])
                              ? doItem["good description"][0]
                              : doItem["good description"]}
                          </p>
                        </div>
                      )}

                      {/* Quantity */}
                      {doItem["quantity"] && doItem["quantity"].length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Quantity
                          </p>
                          <p className="text-sm text-gray-800">
                            {Array.isArray(doItem["quantity"])
                              ? doItem["quantity"][0]
                              : doItem["quantity"]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {uploadedDOs.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-gray-400 mb-4">
                <svg
                  className="h-16 w-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-1">
                No delivery orders yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Start by uploading your first delivery order PDF
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
