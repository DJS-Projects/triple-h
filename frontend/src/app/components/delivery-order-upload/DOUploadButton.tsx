"use client";

import React, { useState } from "react";
import { Upload, MoveRight, X } from "lucide-react";
import { Button } from "@/app/components/button";
import DirectUploadDO from "@/app/components/delivery-order-upload/direct-upload-do";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DOUploadButtonProps {
  buttonText?: string;
  buttonVariant?: "default" | "outline";
  buttonClassName?: string;
  onDOProcessed?: (parsedInfo: any) => void;
}

const DOUploadButton: React.FC<DOUploadButtonProps> = ({
  buttonText = "Upload Delivery Order",
  buttonVariant = "default",
  buttonClassName = "",
  onDOProcessed,
}) => {
  const [showDirectUpload, setShowDirectUpload] = useState(false);
  const [showParsedModal, setShowParsedModal] = useState(false);
  const [doData, setDOData] = useState<any>(null);

  const isEmpty = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "object" && Object.keys(value).length === 0) return true;
    return false;
  };

  const handleDirectFileUpload = async (file: File, parsedInfo?: any) => {
    try {
      console.log("Processing DO file:", file.name);
      console.log("Raw parsedInfo:", parsedInfo);

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

        setDOData(dataToSet);
        setShowParsedModal(true);
        if (onDOProcessed) onDOProcessed(parsedInfo);
      } else {
        alert("Failed to parse delivery order. Please check the file and try again.");
      }
    } catch (error) {
      console.error("Error processing file:", error);
      alert("An error occurred while processing the file.");
    }
  };

  const handleCloseParsedModal = () => {
    setShowParsedModal(false);
    setDOData(null);
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

      <DirectUploadDO
        isOpen={showDirectUpload}
        onClose={() => setShowDirectUpload(false)}
        onFileUpload={handleDirectFileUpload}
      />

      <Dialog open={showParsedModal} onOpenChange={handleCloseParsedModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Parsed Delivery Order Information</DialogTitle>
            <DialogDescription>
              Review the extracted delivery order data below
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {doData ? (
              <div className="space-y-4">
                {/* Sold To Section */}
                {!isEmpty(doData["sold to"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Sold To</h3>
                    <p className="text-sm text-gray-700">{doData["sold to"]}</p>
                    <p className="text-sm text-gray-700">{doData["sold to (address)"]}</p>
                  </div>
                )}

                {/* Delivered To Section */}
                {!isEmpty(doData["delivered to"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Delivered To</h3>
                    <p className="text-sm text-gray-700">{doData["delivered to"]}</p>
                    <p className="text-sm text-gray-700">{doData["delivered to (address)"]}</p>
                  </div>
                )}

                {/* D/O Number Section */}
                {!isEmpty(doData["D/O number"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">D/O Number</h3>
                    {Array.isArray(doData["D/O number"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["D/O number"].map(
                          (inv: string, idx: number) =>
                            !isEmpty(inv) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {inv}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["D/O number"]}</p>
                    )}
                  </div>
                )}
                {/* P/O Number Section */}
                {!isEmpty(doData["P/O number"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">P/O Number</h3>
                    {Array.isArray(doData["P/O number"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["P/O number"].map(
                          (inv: string, idx: number) =>
                            !isEmpty(inv) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {inv}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["P/O number"]}</p>
                    )}
                  </div>
                )}
                {/* Vehicle Number Section */}
                {!isEmpty(doData["Vehicle number"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Vehicle Number</h3>
                    {Array.isArray(doData["Vehicle number"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["Vehicle number"].map(
                          (inv: string, idx: number) =>
                            !isEmpty(inv) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {inv}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["Vehicle number"]}</p>
                    )}
                  </div>
                )}
                {/* Date Section */}
                {!isEmpty(doData["date"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Date</h3>
                    {Array.isArray(doData["date"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["date"].map(
                          (d: string, idx: number) =>
                            !isEmpty(d) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {d}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["date"]}</p>
                    )}
                  </div>
                )}

                {/* Good Description Section */}
                {!isEmpty(doData["good description"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Good Description</h3>
                    {Array.isArray(doData["good description"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["good description"].map(
                          (good: string, idx: number) =>
                            !isEmpty(good) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {good}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["good description"]}</p>
                    )}
                  </div>
                )}

                {/* Quantity Section */}
                {!isEmpty(doData["quantity"]) && (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold text-[#006DAE] mb-2">Quantity</h3>
                    {Array.isArray(doData["quantity"]) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {doData["quantity"].map(
                          (qty: string, idx: number) =>
                            !isEmpty(qty) && (
                              <li key={idx} className="text-sm text-gray-700">
                                {qty}
                              </li>
                            )
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-700">{doData["quantity"]}</p>
                    )}
                  </div>
                )}

                {/* Raw JSON for debugging */}
                <details className="border rounded-lg p-4 bg-gray-50">
                  <summary className="font-semibold text-[#006DAE] cursor-pointer">
                    Raw JSON Data
                  </summary>
                  <pre className="mt-2 text-xs bg-white p-2 rounded overflow-auto max-h-48">
                    {JSON.stringify(doData, null, 2)}
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

export default DOUploadButton;
