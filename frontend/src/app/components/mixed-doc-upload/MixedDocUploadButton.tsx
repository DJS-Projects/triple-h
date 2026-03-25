"use client";

import React, { useState } from "react";
import { Upload, MoveRight, X } from "lucide-react";
import { Button } from "@/app/components/button";
import DirectUploadMixedDoc from "@/app/components/mixed-doc-upload/direct-upload-mixed-doc";
import { normalizeResponseStructure, normalizeDeliveryOrderData } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface MixedDocUploadButtonProps {
  buttonText?: string;
  buttonVariant?: "default" | "outline";
  buttonClassName?: string;
  onDocProcessed?: (parsedInfo: any) => void;
}

const MixedDocUploadButton: React.FC<MixedDocUploadButtonProps> = ({
  buttonText = "Upload Document",
  buttonVariant = "default",
  buttonClassName = "",
  onDocProcessed,
}) => {
  const [showDirectUpload, setShowDirectUpload] = useState(false);
  const [showParsedModal, setShowParsedModal] = useState(false);
  const [docData, setDocData] = useState<any>(null);
  const [documentAnalysis, setDocumentAnalysis] = useState<any>(null);
  const [processingMetrics, setProcessingMetrics] = useState<any>(null);

  const isEmpty = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "object" && Object.keys(value).length === 0) return true;
    return false;
  };

  const handleDirectFileUpload = async (file: File, parsedInfo?: any) => {
    try {
      console.log("Processing mixed doc file:", file.name);
      console.log("Raw parsedInfo:", parsedInfo);
      console.log("parsedInfo.parsed_info:", parsedInfo?.parsed_info);
      console.log("parsedInfo.parsed_info keys:", Object.keys(parsedInfo?.parsed_info || {}));

      if (parsedInfo && parsedInfo.parsed_info) {
        let dataToSet = parsedInfo.parsed_info;

        if (typeof dataToSet === "string") {
          const jsonMatch = dataToSet.match(/```json\n([\s\S]*?)\n```/);
          let potentialJsonString = jsonMatch?.[1] || dataToSet;

          try {
            const parsedJson = JSON.parse(potentialJsonString);
            if (typeof parsedJson === "object" && parsedJson !== null) {
              dataToSet = parsedJson;
            } else {
              console.warn("parsedInfo.parsed_info was a string, parsed to non-object/null. Displaying as raw text.");
            }
          } catch (e: unknown) {
            console.warn("Invalid JSON string, displaying as raw text:", e);
          }
        }

        // Normalize the response structure to handle both formats
        let normalizedStructure = normalizeResponseStructure(dataToSet);
        
        // Then normalize the delivery order data (field names, arrays, etc.)
        if (normalizedStructure.delivery_order_data) {
          normalizedStructure.delivery_order_data = normalizeDeliveryOrderData(normalizedStructure.delivery_order_data);
        }

        console.log("Normalized docData:", normalizedStructure);
        setDocData(normalizedStructure);
        setDocumentAnalysis(parsedInfo.document_analysis);
        setProcessingMetrics({
          model_used: parsedInfo.model_used,
          token_usage: parsedInfo.token_usage,
          processing_time: parsedInfo.processing_time,
        });
        setShowParsedModal(true);
        if (onDocProcessed) onDocProcessed(parsedInfo);
      } else {
        alert("Failed to parse document. Please check the file and try again.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert("An error occurred while processing the file.");
    }
  };

  const handleCloseParsedModal = () => {
    setShowParsedModal(false);
    setDocData(null);
    setDocumentAnalysis(null);
    setProcessingMetrics(null);
  };

  const getDocTypeLabel = (type: string): string => {
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
  };

  return (
    <>
      <Button
        variant={buttonVariant}
        className={buttonClassName}
        onClick={() => setShowDirectUpload(true)}
      >
        <Upload className="h-4 w-4 mr-2" />
        {buttonText}
      </Button>

      <DirectUploadMixedDoc
        isOpen={showDirectUpload}
        onClose={() => setShowDirectUpload(false)}
        onFileUpload={handleDirectFileUpload}
      />

      <Dialog open={showParsedModal} onOpenChange={handleCloseParsedModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parsed Document Information</DialogTitle>
            <DialogDescription>
              Review the extracted document data below
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {docData ? (
              <div className="space-y-6">
                {/* Debug Info */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs">
                  <p className="font-mono text-yellow-800">
                    DEBUG: docData keys = {Object.keys(docData).join(", ")}
                  </p>
                  <p className="font-mono text-yellow-800 mt-1">
                    delivery_order_data exists: {docData.delivery_order_data ? "YES" : "NO"}
                  </p>
                  <p className="font-mono text-yellow-800 mt-1">
                    weighing_bill_data exists: {docData.weighing_bill_data ? "YES" : "NO"}
                  </p>
                  <p className="font-mono text-yellow-800 mt-1">
                    invoice_data exists: {docData.invoice_data ? "YES" : "NO"}
                  </p>
                </div>

                {/* Processing Metrics */}
                {processingMetrics && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Processing Details</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Model Used</p>
                        <p className="text-sm font-mono text-gray-800 break-words">{processingMetrics.model_used}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Processing Time</p>
                        <p className="text-sm font-mono text-gray-800">{processingMetrics.processing_time}s</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Token Usage</p>
                        <p className="text-xs text-gray-700">
                          Input: {processingMetrics.token_usage?.input_tokens || 0}
                        </p>
                        <p className="text-xs text-gray-700">
                          Output: {processingMetrics.token_usage?.output_tokens || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Document Type Analysis */}
                {documentAnalysis && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Document Analysis</h3>
                    <div className="flex flex-wrap gap-2">
                      {documentAnalysis.detected_types && documentAnalysis.detected_types.map((type: string) => (
                        <span
                          key={type}
                          className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800"
                        >
                          {getDocTypeLabel(type)}
                        </span>
                      ))}
                    </div>
                    {documentAnalysis.is_mixed && (
                      <p className="text-sm text-blue-700 mt-2">
                        ✓ Mixed document detected - contains multiple document types
                      </p>
                    )}
                  </div>
                )}

                {/* Delivery Order Data */}
                {docData.delivery_order_data && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#3a4043] mb-3 pb-2 border-b">
                      Delivery Order Information
                    </h3>
                    <div className="space-y-3">
                      {docData.delivery_order_data["sold to"] && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Sold To</p>
                          <p className="text-sm text-gray-700">{docData.delivery_order_data["sold to"]}</p>
                          {docData.delivery_order_data["sold to (address)"] && (
                            <p className="text-sm text-gray-600">{docData.delivery_order_data["sold to (address)"]}</p>
                          )}
                        </div>
                      )}
                      {docData.delivery_order_data["delivered to"] && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Delivered To</p>
                          <p className="text-sm text-gray-700">{docData.delivery_order_data["delivered to"]}</p>
                          {docData.delivery_order_data["delivered to (address)"] && (
                            <p className="text-sm text-gray-600">{docData.delivery_order_data["delivered to (address)"]}</p>
                          )}
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["D/O number"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">D/O Number</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["D/O number"]) 
                              ? docData.delivery_order_data["D/O number"].join(", ")
                              : docData.delivery_order_data["D/O number"]}
                          </p>
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["P/O number"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">P/O Number</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["P/O number"]) 
                              ? docData.delivery_order_data["P/O number"].join(", ")
                              : docData.delivery_order_data["P/O number"]}
                          </p>
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["Vehicle number"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Vehicle Number</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["Vehicle number"]) 
                              ? docData.delivery_order_data["Vehicle number"].join(", ")
                              : docData.delivery_order_data["Vehicle number"]}
                          </p>
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["date"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Date</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["date"]) 
                              ? docData.delivery_order_data["date"].join(", ")
                              : docData.delivery_order_data["date"]}
                          </p>
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["good description"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Good Description</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["good description"]) 
                              ? docData.delivery_order_data["good description"].join(", ")
                              : docData.delivery_order_data["good description"]}
                          </p>
                        </div>
                      )}
                      {!isEmpty(docData.delivery_order_data["quantity"]) && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Quantity</p>
                          <p className="text-sm text-gray-700">
                            {Array.isArray(docData.delivery_order_data["quantity"]) 
                              ? docData.delivery_order_data["quantity"].join(", ")
                              : docData.delivery_order_data["quantity"]}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Weighing Bill Data */}
                {docData.weighing_bill_data && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#3a4043] mb-3 pb-2 border-b">
                      Weighing Bill Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {docData.weighing_bill_data.weighing_no && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Weighing No</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.weighing_no}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.contract_no && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Contract No</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.contract_no}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.vehicle_no && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Vehicle No</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.vehicle_no}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.gross_weight && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Gross Weight</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.gross_weight}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.tare_weight && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Tare Weight</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.tare_weight}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.net_weight && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Net Weight</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.net_weight}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.off_weight && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Off Weight</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.off_weight}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.actual_weight && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Actual Weight</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.actual_weight}</p>
                        </div>
                      )}
                      {docData.weighing_bill_data.gross_time && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Gross Time</p>
                          <p className="text-sm text-gray-700">{docData.weighing_bill_data.gross_time}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Data */}
                {docData.invoice_data && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#3a4043] mb-3 pb-2 border-b">
                      Invoice Information
                    </h3>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {docData.invoice_data.invoice_number && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Invoice #</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.invoice_number}</p>
                        </div>
                      )}
                      {docData.invoice_data.invoice_date && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Invoice Date</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.invoice_date}</p>
                        </div>
                      )}
                      {docData.invoice_data.bill_to && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Bill To</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.bill_to}</p>
                        </div>
                      )}
                      {docData.invoice_data.ship_to && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ship To</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.ship_to}</p>
                        </div>
                      )}
                    </div>
                    {docData.invoice_data.items && docData.invoice_data.items.length > 0 && (
                      <div className="mb-4 overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100">
                              <th className="text-left p-2 font-semibold">Description</th>
                              <th className="text-right p-2 font-semibold">Qty</th>
                              <th className="text-right p-2 font-semibold">Unit Price</th>
                              <th className="text-right p-2 font-semibold">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {docData.invoice_data.items.map((item: any, idx: number) => (
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
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                      {docData.invoice_data.subtotal && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Subtotal</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.subtotal}</p>
                        </div>
                      )}
                      {docData.invoice_data.tax && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Tax</p>
                          <p className="text-sm text-gray-700">{docData.invoice_data.tax}</p>
                        </div>
                      )}
                      {docData.invoice_data.total && (
                        <div className="col-span-2">
                          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total</p>
                          <p className="text-lg font-bold text-gray-800">{docData.invoice_data.total}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Raw JSON for debugging */}
                <details className="border rounded-lg p-4 bg-gray-50">
                  <summary className="font-semibold text-[#3a4043] cursor-pointer">
                    Raw JSON Data
                  </summary>
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-48">
                    {JSON.stringify(docData, null, 2)}
                  </pre>
                </details>
              </div>
            ) : (
              <p className="text-gray-500">No data to display</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseParsedModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MixedDocUploadButton;
