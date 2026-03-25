"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/card";
import MixedDocUploadButton from "@/app/components/mixed-doc-upload/MixedDocUploadButton";
import { AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { normalizeDeliveryOrderData, ensureArray, normalizeResponseStructure } from "@/lib/utils";

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

export default function MixedDocumentsPage() {
  const [uploadedDocs, setUploadedDocs] = useState<MixedDocumentData[]>([]);
  const [uploadStatus, setUploadStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleDocProcessed = (parsedInfo: any) => {
    try {
      if (parsedInfo && parsedInfo.parsed_info) {
        // First normalize the response structure to handle both formats
        let normalizedStructure = normalizeResponseStructure(parsedInfo.parsed_info);
        
        // Then normalize the delivery order data (field names, arrays, etc.)
        if (normalizedStructure.delivery_order_data) {
          normalizedStructure.delivery_order_data = normalizeDeliveryOrderData(normalizedStructure.delivery_order_data);
        }
        
        const normalizedDoc: any = {
          ...normalizedStructure,
          document_analysis: parsedInfo.document_analysis,
          model_used: parsedInfo.model_used,
          ocr_model: parsedInfo.ocr_model,
          ocr_model_name: parsedInfo.ocr_model_name,
          confidence_score: parsedInfo.confidence_score,
          token_usage: parsedInfo.token_usage,
          processing_time: parsedInfo.processing_time,
        };
        
        setUploadedDocs((prev) => [...prev, normalizedDoc]);
        setUploadStatus({
          type: "success",
          message: `Document processed successfully! Detected types: ${parsedInfo.document_analysis?.detected_types?.join(", ")}`,
        });

        // Clear status message after 3 seconds
        setTimeout(() => {
          setUploadStatus({ type: null, message: "" });
        }, 3000);
      }
    } catch (error) {
      setUploadStatus({
        type: "error",
        message: "Failed to process document.",
      });
    }
  };

  const getDocTypeLabel = (types: string[] | undefined): string => {
    if (!types || types.length === 0) return "Unknown";
    return types
      .map((type) => {
        switch (type) {
          case "delivery_order":
            return "Delivery Order";
          case "weighing_bill":
            return "Weighing Bill";
          case "invoice":
            return "Invoice";
          default:
            return type;
        }
      })
      .join(" + ");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-[#006DAE] mb-2">
            Mixed Documents Processing
          </h1>
          <p className="text-gray-600">
            Upload and extract data from mixed document PDFs. Supports Delivery Orders, Invoices, Weighing Bills, or any combination of these document types.
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
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a PDF file (Delivery Order, Invoice, Weighing Bill, or mixed documents)
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center py-8">
            <MixedDocUploadButton
              buttonText="Upload Mixed Document"
              buttonVariant="default"
              onDocProcessed={handleDocProcessed}
            />
          </CardContent>
        </Card>

        {/* Uploaded Documents Section */}
        {uploadedDocs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Processed Documents</CardTitle>
              <CardDescription>
                {uploadedDocs.length} document{uploadedDocs.length !== 1 ? "s" : ""} processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {uploadedDocs.map((docItem, index) => (
                  <div key={index} className="border rounded-lg p-4 hover:bg-gray-50 transition">
                    {/* Processing Metrics */}
                    {(docItem.model_used || docItem.processing_time || docItem.ocr_model_name || docItem.confidence_score !== undefined) && (
                      <div className="mb-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Processing Metrics</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {docItem.model_used && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">AI Model</p>
                              <p className="text-xs font-mono text-gray-800 break-words">{docItem.model_used}</p>
                            </div>
                          )}
                          {docItem.ocr_model_name && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reading Model</p>
                              <p className="text-xs font-mono text-gray-800">{docItem.ocr_model_name}</p>
                            </div>
                          )}
                          {docItem.confidence_score !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Confidence</p>
                              <p className="text-xs font-mono text-gray-800">{docItem.confidence_score}%</p>
                            </div>
                          )}
                          {docItem.processing_time !== undefined && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Time</p>
                              <p className="text-xs font-mono text-gray-800">{docItem.processing_time}s</p>
                            </div>
                          )}
                          {docItem.token_usage && (
                            <>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Input Tokens</p>
                                <p className="text-xs font-mono text-gray-800">{docItem.token_usage.input_tokens}</p>
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Output Tokens</p>
                                <p className="text-xs font-mono text-gray-800">{docItem.token_usage.output_tokens}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Summary Section */}
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                        Summary
                      </h3>
                      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                        {/* Delivered Date */}
                        {docItem.delivery_order_data?.["date"] && Array.isArray(docItem.delivery_order_data["date"]) && docItem.delivery_order_data["date"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Delivered Date
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.delivery_order_data["date"][0]}
                            </p>
                          </div>
                        )}

                        {/* Invoice No */}
                        {docItem.invoice_data?.["invoice_number"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Invoice No
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.invoice_data["invoice_number"]}
                            </p>
                          </div>
                        )}

                        {/* Invoice Date */}
                        {docItem.invoice_data?.["invoice_date"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Invoice Date
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.invoice_data["invoice_date"]}
                            </p>
                          </div>
                        )}

                        {/* D/O Issuer Name */}
                        {docItem.delivery_order_data?.["D/O issuer name"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              D/O Issuer Name
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.delivery_order_data["D/O issuer name"]}
                            </p>
                          </div>
                        )}

                        {/* D/O Number */}
                        {docItem.delivery_order_data?.["D/O number"] && docItem.delivery_order_data["D/O number"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              D/O Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.delivery_order_data["D/O number"].join(", ")}
                            </p>
                          </div>
                        )}

                        {/* P/O Number */}
                        {docItem.delivery_order_data?.["P/O number"] && docItem.delivery_order_data["P/O number"].length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              P/O Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.delivery_order_data["P/O number"].join(", ")}
                            </p>
                          </div>
                        )}

                        {/* Contract No */}
                        {docItem.weighing_bill_data?.["contract_no"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Contract No
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.weighing_bill_data["contract_no"]}
                            </p>
                          </div>
                        )}

                        {docItem.weighing_bill_data?.["vehicle_no"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Vehicle Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.weighing_bill_data["vehicle_no"]}
                            </p>
                          </div>
                        )}
                        {!docItem.weighing_bill_data?.["vehicle_no"] && docItem.delivery_order_data?.["Vehicle number"] && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase">
                              Vehicle Number
                            </p>
                            <p className="text-sm text-gray-800">
                              {docItem.delivery_order_data["Vehicle number"].join(", ")}
                            </p>
                          </div>
                        )}

                        {/* Total Weight */}
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase">
                            Total Weight
                          </p>
                          <p className="text-lg font-bold text-blue-600">
                            {(() => {
                              // Priority 1: Use weighing bill actual_weight if available
                              if (docItem.weighing_bill_data?.["actual_weight"]) {
                                const weight = docItem.weighing_bill_data["actual_weight"];
                                // Extract numeric value if it contains unit (e.g., "28.21 t")
                                const match = weight.match(/([0-9.]+)/);
                                if (match) {
                                  return `${parseFloat(match[1]).toFixed(4)} MT`;
                                }
                                return weight;
                              }
                              // Priority 2: Use delivery order total_weight_mt
                              if (docItem.delivery_order_data?.["total_weight_mt"]) {
                                return `${parseFloat(docItem.delivery_order_data["total_weight_mt"]).toFixed(4)} MT`;
                              }
                              // Priority 3: Calculate from items if available
                              if (docItem.delivery_order_data?.["items"] && Array.isArray(docItem.delivery_order_data["items"])) {
                                const totalWeight = docItem.delivery_order_data["items"].reduce((sum, item) => {
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

                    {/* Delivery Order Data */}
                    {docItem.delivery_order_data && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Delivery Order Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                          {/* Sold To */}
                          {docItem.delivery_order_data["sold to"] && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                Sold To
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["sold to"]}
                              </p>
                              {docItem.delivery_order_data["sold to (address)"] && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {docItem.delivery_order_data["sold to (address)"]}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Delivered To */}
                          {docItem.delivery_order_data["delivered to"] && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                Delivered To
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["delivered to"]}
                              </p>
                              {docItem.delivery_order_data["delivered to (address)"] && (
                                <p className="text-xs text-gray-600 mt-1">
                                  {docItem.delivery_order_data["delivered to (address)"]}
                                </p>
                              )}
                            </div>
                          )}

                          {/* D/O Numbers */}
                          {docItem.delivery_order_data["D/O number"] && docItem.delivery_order_data["D/O number"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                D/O #
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["D/O number"].join(", ")}
                              </p>
                            </div>
                          )}

                          {/* P/O Numbers */}
                          {docItem.delivery_order_data["P/O number"] && docItem.delivery_order_data["P/O number"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                P/O #
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["P/O number"].join(", ")}
                              </p>
                            </div>
                          )}

                          {/* Vehicle Numbers */}
                          {docItem.delivery_order_data["Vehicle number"] && docItem.delivery_order_data["Vehicle number"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                Vehicle #
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["Vehicle number"].join(", ")}
                              </p>
                            </div>
                          )}

                          {/* Dates */}
                          {docItem.delivery_order_data["date"] && Array.isArray(docItem.delivery_order_data["date"]) && docItem.delivery_order_data["date"].length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">
                                Date
                              </p>
                              <p className="text-sm text-gray-800">
                                {docItem.delivery_order_data["date"].join(", ")}
                              </p>
                            </div>
                          )}

                          {/* Items Table */}
                          {docItem.delivery_order_data["items"] && Array.isArray(docItem.delivery_order_data["items"]) && docItem.delivery_order_data["items"].length > 0 ? (
                            <div className="col-span-2">
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
                                    {docItem.delivery_order_data["items"].map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-gray-50">
                                        <td className="border border-gray-300 px-3 py-2">{idx + 1}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.description || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.quantity || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">{item.weight_mt ? parseFloat(item.weight_mt).toFixed(4) : "-"}</td>
                                      </tr>
                                    ))}
                                    {/* Total Row */}
                                    {(docItem.delivery_order_data["total_quantity"] || docItem.delivery_order_data["total_weight_mt"]) && (
                                      <tr className="bg-blue-50 font-semibold">
                                        <td className="border border-gray-300 px-3 py-2" colSpan={2}>Total</td>
                                        <td className="border border-gray-300 px-3 py-2">{docItem.delivery_order_data["total_quantity"] || "-"}</td>
                                        <td className="border border-gray-300 px-3 py-2">
                                          {docItem.delivery_order_data["total_weight_mt"] ? `${parseFloat(docItem.delivery_order_data["total_weight_mt"]).toFixed(4)} MT` : "-"}
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
                              {docItem.delivery_order_data["good description"] && Array.isArray(docItem.delivery_order_data["good description"]) && docItem.delivery_order_data["good description"].length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase">
                                    Description
                                  </p>
                                  <p className="text-sm text-gray-800">
                                    {docItem.delivery_order_data["good description"].join(", ")}
                                  </p>
                                </div>
                              )}

                              {/* Quantity */}
                              {docItem.delivery_order_data["quantity"] && Array.isArray(docItem.delivery_order_data["quantity"]) && docItem.delivery_order_data["quantity"].length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 uppercase">
                                    Quantity
                                  </p>
                                  <p className="text-sm text-gray-800">
                                    {docItem.delivery_order_data["quantity"].join(", ")}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Weighing Bill Data */}
                    {docItem.weighing_bill_data && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Weighing Bill Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                          {docItem.weighing_bill_data.weighing_no && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Weighing No</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.weighing_no}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.contract_no && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Contract No</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.contract_no}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.vehicle_no && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Vehicle No</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.vehicle_no}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.gross_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Gross Weight</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.gross_weight}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.tare_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Tare Weight</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.tare_weight}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.net_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Net Weight</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.net_weight}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.off_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Off Weight</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.off_weight}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.actual_weight && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Actual Weight</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.actual_weight}</p>
                            </div>
                          )}
                          {docItem.weighing_bill_data.gross_time && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Gross Time</p>
                              <p className="text-sm text-gray-800">{docItem.weighing_bill_data.gross_time}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Invoice Data */}
                    {docItem.invoice_data && (
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                          Invoice Information
                        </h3>
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 mb-4">
                          {docItem.invoice_data.invoice_number && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Invoice #</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.invoice_number}</p>
                            </div>
                          )}
                          {docItem.invoice_data.invoice_date && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Invoice Date</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.invoice_date}</p>
                            </div>
                          )}
                          {docItem.invoice_data.bill_to && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Bill To</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.bill_to}</p>
                            </div>
                          )}
                          {docItem.invoice_data.ship_to && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Ship To</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.ship_to}</p>
                            </div>
                          )}
                        </div>

                        {/* Invoice Items Table */}
                        {docItem.invoice_data.items && docItem.invoice_data.items.length > 0 && (
                          <div className="mb-4 overflow-x-auto">
                            <table className="min-w-full text-sm">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="text-left p-2 font-semibold">Description</th>
                                  <th className="text-right p-2 font-semibold">Quantity</th>
                                  <th className="text-right p-2 font-semibold">Unit Price</th>
                                  <th className="text-right p-2 font-semibold">Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {docItem.invoice_data.items.map((item, idx) => (
                                  <tr key={idx} className="border-t">
                                    <td className="p-2">{item.description}</td>
                                    <td className="text-right p-2">{item.quantity}</td>
                                    <td className="text-right p-2">{item.unit_price}</td>
                                    <td className="text-right p-2">{item.amount}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Invoice Totals */}
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                          {docItem.invoice_data.subtotal && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Subtotal</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.subtotal}</p>
                            </div>
                          )}
                          {docItem.invoice_data.tax && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Tax</p>
                              <p className="text-sm text-gray-800">{docItem.invoice_data.tax}</p>
                            </div>
                          )}
                          {docItem.invoice_data.total && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase">Total</p>
                              <p className="text-sm font-bold text-gray-800">{docItem.invoice_data.total}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {uploadedDocs.length === 0 && (
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
                No documents processed yet
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                Start by uploading your first document (Delivery Order, Invoice, Weighing Bill, or mixed)
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
