"use client";

import React, { useState } from "react";
import { Upload, MoveRight, X } from "lucide-react";
import { Button } from "@/app/components/button";
import DirectUpload from "@/app/components/resume-upload/direct-upload";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useSession } from 'next-auth/react'; // <--- Import useSession

interface ResumeUploadButtonProps {
  buttonText?: string;
  buttonVariant?: "default" | "outline";
  buttonClassName?: string;
  onResumeProcessed?: (parsedInfo: any) => void;
  // candidateEmail prop is removed as it will be fetched from session
}

const ResumeUploadButton: React.FC<ResumeUploadButtonProps> = ({
  buttonText = "Upload Resume",
  buttonVariant = "default",
  buttonClassName = "",
  onResumeProcessed,
  // candidateEmail is no longer destructured here
}) => {
  const { data: session, status } = useSession(); // <--- Get session data
  const [showDirectUpload, setShowDirectUpload] = useState(false);
  const [showParsedModal, setShowParsedModal] = useState(false);
  const [resumeData, setResumeData] = useState<any>(null);

  const isEmpty = (value: any) => {
    if (value === null || value === undefined) return true;
    if (typeof value === "string" && value.trim() === "") return true;
    if (Array.isArray(value) && value.length === 0) return true;
    if (typeof value === "object" && Object.keys(value).length === 0) return true;
    return false;
  };

  const handleDirectFileUpload = async (file: File, parsedInfo?: any) => {
    try {
      console.log("Processing file:", file.name);
      console.log("Raw parsedInfo:", parsedInfo);

      // --- Get user email from session ---
      const userEmail = session?.user?.email;
      if (!userEmail) {
        // If session is still loading, or user is not logged in
        if (status === 'loading') {
          alert("Session is loading. Please wait a moment and try again.");
        } else {
          alert("User not logged in or session not found. Cannot update resume.");
        }
        return; // Stop execution if no user email
      }
      // --- End user email check ---

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

        setResumeData(dataToSet);
        setShowParsedModal(true);
        if (onResumeProcessed) onResumeProcessed(parsedInfo);

        // --- API Call to update DB ---
        // Condition now uses userEmail
        if (userEmail && dataToSet) {
          console.log("DEBUG: Condition 'userEmail && dataToSet' is TRUE. Attempting API call.");
          try {
            console.log(`Attempting to update DB for email: ${userEmail} with parsed data.`);
            const response = await fetch(
              `http://127.0.0.1:8000/profiles/${userEmail}/resume`, // <--- Use userEmail here
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSet),
              }
            );

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log("✅ Resume data successfully updated in DB:", result);
          } catch (error: unknown) {
            console.error("❌ Error updating resume data:", error);
            let errorMessage = "An unknown error occurred.";
            if (error instanceof Error) {
              errorMessage = error.message;
            } else if (typeof error === 'string') {
              errorMessage = error;
            } else if (typeof error === 'object' && error !== null && 'detail' in error && typeof (error as any).detail === 'string') {
                errorMessage = (error as any).detail;
            }
            alert(`Error updating resume data in database: ${errorMessage}`);
          }
        } else {
          console.warn("API call skipped. Reason: 'userEmail' or 'dataToSet' is falsy.");
          console.warn("  - userEmail:", userEmail);
          console.warn("  - dataToSet:", dataToSet);
        }
        // --- End API Call ---

      } else {
        alert(`Resume ${file.name} uploaded successfully!`);
      }
    } catch (error: unknown) {
      console.error("Error processing file:", error);
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      alert(`Error processing resume: ${errorMessage}`);
    }
  };

  // Optionally, disable the button or show a loading state if session is not ready
  const isButtonDisabled = status === 'loading' || !session?.user?.email;
  const buttonTooltip = status === 'loading' ? 'Loading user session...' : (!session?.user?.email ? 'Please log in to upload resume' : '');

  return (
    <>
      {/* Upload Button */}
      <Button
        onClick={() => setShowDirectUpload(true)}
        variant={buttonVariant}
        className={
          buttonClassName ||
          "bg-[#635bff] hover:bg-[#5748e5] text-white text-base font-semibold px-6 py-3 rounded-full shadow-md transition-all duration-200"
        }
        disabled={isButtonDisabled} // <--- Disable button if session not ready
        title={buttonTooltip} // <--- Add tooltip for disabled state
      >
        <Upload className="mr-2 h-4 w-4" />
        {buttonText}
        {buttonText.includes("Skip") && <MoveRight className="ml-2 h-3 w-3" />}
      </Button>

      {/* Direct Upload Modal */}
      <DirectUpload
        isOpen={showDirectUpload}
        onClose={() => setShowDirectUpload(false)}
        onFileUpload={handleDirectFileUpload}
      />

      {/* Parsed Resume Modal */}
      <Dialog open={showParsedModal} onOpenChange={setShowParsedModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader className="flex justify-between items-center">
            <DialogTitle className="text-xl font-semibold">
              Resume Parsed Successfully
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowParsedModal(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </DialogHeader>

          <DialogDescription className="text-sm text-gray-500 mb-4">
            Below is the extracted information from your uploaded resume.
          </DialogDescription>

          {resumeData ? (
            <div className="bg-gray-50 rounded-xl p-4 max-h-[400px] overflow-y-auto border">
              {typeof resumeData !== "string" ? (
                <div className="space-y-3 text-sm">
                  {/* Display the whole resumeData object as formatted JSON */}
                  <div>
                    <p><strong>Whole Parsed Data (JSON):</strong></p>
                    <pre className="ml-4 bg-gray-100 p-2 rounded overflow-x-auto">
                      {JSON.stringify(resumeData, null, 2)}
                    </pre>
                  </div>

                  {/* Personal Identifiers */}
                  {!isEmpty(resumeData.personal_identifiers) && (
                    <div>
                      <p><strong>Personal Identifiers:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        <li><strong>Full Name:</strong> {resumeData.personal_identifiers.fullName || ''}</li>
                        <li><strong>Email:</strong> {resumeData.personal_identifiers.emailAddress || ''}</li>
                        <li><strong>Phone:</strong> {resumeData.personal_identifiers.phoneNumber || ''}</li>
                        <li><strong>NRIC:</strong> {resumeData.personal_identifiers.nric || ''}</li>
                        <li><strong>Date of Birth:</strong> {resumeData.personal_identifiers.dateOfBirth || ''}</li>
                        <li><strong>Preferred Role:</strong> {resumeData.personal_identifiers.preferred_role || ''}</li>
                        <li><strong>Preferred Industry:</strong> {resumeData.personal_identifiers.preferred_industry || ''}</li>
                        <li><strong>Preferred Location:</strong> {resumeData.personal_identifiers.preferred_location || ''}</li>
                        {/* Add other personal_identifiers fields here if needed, following the same pattern */}
                      </ul>
                    </div>
                  )}

                  {/* Education */}
                  {resumeData.education && Array.isArray(resumeData.education) && resumeData.education.length > 0 && (
                    <div>
                      <p><strong>Education:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {resumeData.education.map((edu: any, index: number) => (
                          <li key={index}>
                            {[
                              edu.level || '',
                              edu.fieldOfStudy && `in ${edu.fieldOfStudy}`,
                              edu.institution && `from ${edu.institution}`,
                              edu.graduationYear && `(Graduated: ${edu.graduationYear})`,
                              edu.cgpa_grade && `CGPA/Grade: ${edu.cgpa_grade}`,
                              edu.award && `Award: ${edu.award}`
                            ].filter(Boolean).join(" ")}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Experience */}
                  {resumeData.experience && Array.isArray(resumeData.experience) && resumeData.experience.length > 0 && (
                    <div>
                      <p><strong>Experience:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {resumeData.experience.map((exp: any, index: number) => (
                          <li key={index}>
                            <strong>{exp.title || ''}</strong> at {exp.employer || ''}
                            {exp.start && exp.end && ` (${exp.start} - ${exp.end})`}
                            {exp.isCurrent && ` (Current)`}
                            <p className="ml-4 text-gray-600">Seniority: {exp.seniorityLevel || ''}</p>
                            <p className="ml-4 text-gray-600">Highlights: {exp.projectHighlights || ''}</p>
                            {/* Add other experience fields here if needed, following the same pattern */}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills */}
                  {resumeData.skills && (
                    (resumeData.skills.HardSkills && Array.isArray(resumeData.skills.HardSkills)) ||
                    (resumeData.skills.SoftSkills && Array.isArray(resumeData.skills.SoftSkills))
                  ) && (
                    <div>
                      <p><strong>Skills:</strong></p>
                      <p className="ml-4">
                        <strong>Hard Skills:</strong> {(resumeData.skills.HardSkills && Array.isArray(resumeData.skills.HardSkills) && resumeData.skills.HardSkills.join(", ")) || ''}
                      </p>
                      <p className="ml-4">
                        <strong>Soft Skills:</strong> {(resumeData.skills.SoftSkills && Array.isArray(resumeData.skills.SoftSkills) && resumeData.skills.SoftSkills.join(", ")) || ''}
                      </p>
                    </div>
                  )}

                  {/* Language Proficiencies */}
                  {resumeData.language_proficiencies && Array.isArray(resumeData.language_proficiencies) && resumeData.language_proficiencies.length > 0 && (
                    <div>
                      <p><strong>Languages:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        {resumeData.language_proficiencies.map((lang: any, index: number) => (
                          <li key={index}>
                            {lang.language || ''}:
                            {` Speaking: ${lang.speaking || ''}`}
                            {` Reading: ${lang.reading || ''}`}
                            {` Writing: ${lang.writing || ''}`}
                            {` Listening: ${lang.listening || ''}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Environment */}
                  {!isEmpty(resumeData.environment) && (
                    <div>
                      <p><strong>Environment Preferences:</strong></p>
                      <ul className="list-disc list-inside ml-4">
                        <li><strong>Communication Medium:</strong> {resumeData.environment.communicationMedium || ''}</li>
                        <li><strong>Team Style:</strong> {resumeData.environment.teamStyle || ''}</li>
                        <li><strong>Workday Structure:</strong> {resumeData.environment.workdayStructure || ''}</li>
                        {/* Add other environment fields here if needed, following the same pattern */}
                      </ul>
                    </div>
                  )}

                  {/* Neurodivergent Strengths */}
                  {resumeData.neurodivergent_strengths && Array.isArray(resumeData.neurodivergent_strengths) && (
                    <div>
                      <p><strong>Neurodivergent Strengths:</strong></p>
                      <p className="ml-4">{(resumeData.neurodivergent_strengths.join(", ")) || ''}</p>
                    </div>
                  )}

                  {/* Fallback for other fields or if specific fields are missing */}
                  {Object.keys(resumeData).length > 0 &&
                    isEmpty(resumeData.personal_identifiers) &&
                    isEmpty(resumeData.education) &&
                    isEmpty(resumeData.experience) &&
                    isEmpty(resumeData.skills) &&
                    isEmpty(resumeData.language_proficiencies) &&
                    isEmpty(resumeData.environment) &&
                    isEmpty(resumeData.neurodivergent_strengths) && (
                      <p>Some parsed data available, but specific display fields are missing. Check console for full object.</p>
                    )}
                  {Object.keys(resumeData).length === 0 && (
                    <p>No specific parsed fields found, but data was an object.</p>
                  )}
                </div>
              ) : (
                <pre className="text-sm whitespace-pre-wrap break-words">
                  {resumeData}
                </pre>
              )}
            </div>
          ) : (
            <p>No parsed data available.</p>
          )}

          <DialogFooter>
            <Button
              onClick={() => setShowParsedModal(false)}
              className="bg-[#635bff] hover:bg-[#5748e5] text-white"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResumeUploadButton;