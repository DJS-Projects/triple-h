"use client";

import React from "react";
import { ArrowLeft, FileText, User } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/app/components/card";
import { Button } from "@/app/components/button";
// Removed Job import as it's no longer needed

interface MethodSelectionProps {
  setFillMethod: (method: "resume" | "manual") => void;
  backButtonRef: React.RefObject<HTMLDivElement | null>;
  selectionHeaderRef: React.RefObject<HTMLDivElement | null>;
  selectionCardsRef: React.RefObject<HTMLDivElement | null>;
  setCurrentPage: (page: string) => void;
  // job: Job;
}

const MethodSelection: React.FC<MethodSelectionProps> = ({
  setFillMethod,
  backButtonRef,
  selectionHeaderRef,
  selectionCardsRef,
  setCurrentPage,
  // job,
}) => (
  <div className="min-h-screen py-8 px-4">
    <div className="max-w-[1400px] mx-auto">
      <div ref={backButtonRef}>
        <Button
          variant="ghost"
          onClick={() => window.history.back()}
          className="mb-6 text-[#006DAE] hover:text-[#00528A] text-base"
        >
          <ArrowLeft className="h-4 w-4 mb-1" />
          Back to Information Form
        </Button>
      </div>

      <Card className="border-2 border-[#d8d4f0] bg-white rounded-2xl mt-10 py-20 px-20">
        {/* <CardHeader ref={selectionHeaderRef} className="text-center pb-8">
          <h1 className="mb-4 text-[#3a4043]">Apply for {job.title}</h1>
          <div className="space-y-2 text-gray-600 mb-6">
            <p className="text-lg">{job.company}</p>
            <p>{job.location}</p>
          </div>
          <p className="text-gray-600">
            Choose how you'd like to fill out your application
          </p>
        </CardHeader> */}

        <CardContent className="space-y-4">
          <div
            ref={selectionCardsRef}
            className="grid grid-cols-1 md:grid-cols-2 gap-10"
          >
            {/* Upload Resume Card */}
            <Card
              className="cursor-pointer border-2 border-[#d8d4f0] hover:border-[#635bff] transition-colors bg-white"
              onClick={() => setFillMethod("resume")}
            >
              <CardContent className="p-6 text-center">
                <FileText className="h-12 w-12 mx-auto mb-4 text-[#635bff]" />
                <h3 className="mb-2 text-[#3a4043]">Upload Resume</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload your resume and we'll automatically fill in your details
                </p>
                <Button className="w-full bg-[#635bff] hover:bg-[#635bff]/90 text-white">
                  Upload & Auto-fill
                </Button>
              </CardContent>
            </Card>

            {/* Fill Manually Card */}
            <Card
              className="cursor-pointer border-2 border-[#d8d4f0] hover:border-[#635bff] transition-colors bg-white"
              onClick={() => setFillMethod("manual")}
            >
              <CardContent className="p-6 text-center">
                <User className="h-12 w-12 mx-auto mb-4 text-[#635bff]" />
                <h3 className="mb-2 text-[#3a4043]">Fill Manually</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter your information manually step by step
                </p>
                <Button
                  variant="outline"
                  className="w-full border-[#635bff] text-[#635bff] hover:bg-[#635bff]/10"
                >
                  Fill Manually
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
);

export default MethodSelection;
