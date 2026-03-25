"use client";

import { useState } from "react";

export type ParsedResumeInfo = {
  parsed_info?: string;
  // Add more specific fields as needed based on your API response
  personalInfo?: {
    fullName?: string;
    email?: string;
    phone?: string;
    address?: string;
    dateOfBirth?: string;
    nric?: string;
  };
  education?: {
    level?: string;
    institution?: string;
    fieldOfStudy?: string;
    graduationYear?: number;
    grade?: string;
  };
  experience?: {
    employer?: string;
    roleTitle?: string;
    industry?: string;
    startDate?: string;
    endDate?: string;
    skills?: string[];
  };
};

export type ResumeUploadResult = {
  success: boolean;
  file: File;
  parsedInfo?: ParsedResumeInfo;
  error?: string;
};

export type CandidateProfile = {
  name: string;
  email: string;
  location: string;
  profileCompletion: number;
  accommodations: string[];
  preferences: {
    workType: string;
    communication: string;
    schedule: string;
  };
  personalIdentifiers: {
    fullName: string;
    dateOfBirth: string;
    gender: string;
    nationality: string;
    emailAddress: string;
    phoneNumber: string;
    residentialAddress: string;
    nric: string;
    oku_card: string;
    linkedin: string;
  };
  jobPreferences: {
    preferredIndustries: string[];
    preferredRoles: string[];
    locationPreference: string;
    availability: string;
  };
  education: {
    level: string;
    fieldOfStudy: string;
    institution: string | null;
    graduationYear: number | null;
    cgpa: number | null;
    grade: string | null;
    award: string | null;
  };
  exp_skill: {
    employer: string;
    industry: string;
    start: string;
    end: string;
    RoleTitle: string;
    YearsInRole: string;
    SeniorityLevel: string;
    SkillsToolsUsed: string;
    ProjectHighlights: string;
    HardSkills: string;
    SoftSkills: string;
    LanguageProficiency: string;
    TechnicalKeywords: string;
    Achievements: string;
  };
  environment: {
    patternRecognition: string;
    attention: string;
    systematicThinking: string;
    bigVsDetail: string;
    taskSwitching: string;
    hyperfocus: string;
    communicationMedium: string;
    clarity: string;
    teamStyle: string;
    presentationComfort: string;
    checkIns: string;
    jobCoach: string;
    auditory: string;
    visual: string;
    workspace: string;
    workdayStructure: string;
  };
};

export default class ResumeUploadHandler {
  /**
   * Upload and parse resume file
   */
  static async uploadAndParseResume(file: File): Promise<ResumeUploadResult> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Replace with your actual API endpoint
      const response = await fetch("/api/parse-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const parsedInfo: ParsedResumeInfo = await response.json();

      return {
        success: true,
        file,
        parsedInfo,
      };
    } catch (error) {
      console.error("Error uploading resume:", error);
      return {
        success: false,
        file,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Parse extracted information and map to candidate profile
   */
  static mapParsedInfoToProfile(
    parsedInfo: ParsedResumeInfo,
    currentProfile: CandidateProfile
  ): Partial<CandidateProfile> {
    const updates: Partial<CandidateProfile> = {};

    // Map personal information
    if (parsedInfo.personalInfo) {
      updates.personalIdentifiers = {
        ...currentProfile.personalIdentifiers,
        fullName: parsedInfo.personalInfo.fullName || currentProfile.personalIdentifiers.fullName,
        emailAddress: parsedInfo.personalInfo.email || currentProfile.personalIdentifiers.emailAddress,
        phoneNumber: parsedInfo.personalInfo.phone || currentProfile.personalIdentifiers.phoneNumber,
        residentialAddress: parsedInfo.personalInfo.address || currentProfile.personalIdentifiers.residentialAddress,
        dateOfBirth: parsedInfo.personalInfo.dateOfBirth || currentProfile.personalIdentifiers.dateOfBirth,
        nric: parsedInfo.personalInfo.nric || currentProfile.personalIdentifiers.nric,
      };
    }

    // Map education information
    if (parsedInfo.education) {
      updates.education = {
        ...currentProfile.education,
        level: parsedInfo.education.level || currentProfile.education.level,
        institution: parsedInfo.education.institution || currentProfile.education.institution,
        fieldOfStudy: parsedInfo.education.fieldOfStudy || currentProfile.education.fieldOfStudy,
        graduationYear: parsedInfo.education.graduationYear || currentProfile.education.graduationYear,
        grade: parsedInfo.education.grade || currentProfile.education.grade,
      };
    }

    // Map experience information
    if (parsedInfo.experience) {
      updates.exp_skill = {
        ...currentProfile.exp_skill,
        employer: parsedInfo.experience.employer || currentProfile.exp_skill.employer,
        RoleTitle: parsedInfo.experience.roleTitle || currentProfile.exp_skill.RoleTitle,
        industry: parsedInfo.experience.industry || currentProfile.exp_skill.industry,
        start: parsedInfo.experience.startDate || currentProfile.exp_skill.start,
        end: parsedInfo.experience.endDate || currentProfile.exp_skill.end,
        SkillsToolsUsed: parsedInfo.experience.skills?.join(", ") || currentProfile.exp_skill.SkillsToolsUsed,
      };
    }

    return updates;
  }

  /**
   * Extract text from parsed_info string (if it's a raw text response)
   */
  static extractFieldsFromText(parsedText: string): ParsedResumeInfo {
    // This is a basic example - adjust based on your actual API response format
    const result: ParsedResumeInfo = {
      parsed_info: parsedText,
      personalInfo: {},
      education: {},
      experience: {},
    };

    // Example parsing logic - customize based on your needs
    const emailMatch = parsedText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
    if (emailMatch) {
      result.personalInfo!.email = emailMatch[1];
    }

    const phoneMatch = parsedText.match(/(\+?\d{1,3}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9})/);
    if (phoneMatch) {
      result.personalInfo!.phone = phoneMatch[1];
    }

    // Add more parsing logic as needed

    return result;
  }
}

/**
 * React hook for resume upload functionality
 */
export function useResumeUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadResume = async (
    file: File,
    onSuccess?: (result: ResumeUploadResult) => void,
    onError?: (error: string) => void
  ): Promise<ResumeUploadResult> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await ResumeUploadHandler.uploadAndParseResume(file);

      if (result.success) {
        onSuccess?.(result);
      } else {
        setUploadError(result.error || "Upload failed");
        onError?.(result.error || "Upload failed");
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setUploadError(errorMessage);
      onError?.(errorMessage);
      return {
        success: false,
        file,
        error: errorMessage,
      };
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadResume,
    isUploading,
    uploadError,
  };
}


// "use client";

// import React from "react";
// import { Upload } from "lucide-react";
// import { Card, CardHeader, CardContent } from "@/app/components/card";
// import { Button } from "@/app/components/button";

// interface ResumeUploadProps {
//   resumeFile: File | null;
//   handleFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
//   clickedField?: string | null;
//   setClickedField?: (field: string | null) => void;
//   showTitle?: boolean;
//   compact?: boolean;
//   onFileProcessed?: (file: File) => void;
// }

// const ResumeUpload: React.FC<ResumeUploadProps> = ({
//   resumeFile,
//   handleFileUpload,
//   clickedField,
//   setClickedField,
//   showTitle = true,
//   compact = false,
//   onFileProcessed,
// }) => {
//   const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
//     handleFileUpload(event);
//     if (event.target.files && event.target.files[0] && onFileProcessed) {
//       onFileProcessed(event.target.files[0]);
//     }
//   };

//   const uploadContent = (
//     <div className={`border-2 border-dashed border-[#d8d4f0] bg-gray-50 rounded-lg text-center ${compact ? 'p-4' : 'p-8'}`}>
//       <Upload className={`mx-auto mb-4 text-gray-600 ${compact ? 'h-8 w-8' : 'h-12 w-12'}`} />
//       <div className="space-y-2">
//         <p className="text-[#3a4043]">Upload your resume</p>
//         <p className="text-sm text-gray-600">
//           Supported formats: PDF, DOC, DOCX (Max 5MB)
//         </p>
//         <input
//           type="file"
//           accept=".pdf,.doc,.docx"
//           onChange={handleFileChange}
//           className="hidden"
//           id="resume-upload"
//           onClick={() => setClickedField?.("resumeUpload")}
//         />
//         <Button
//           type="button"
//           variant="outline"
//           className={`border ${
//             clickedField === "resumeUpload"
//               ? "border-[0.5px] border-gray-300"
//               : "border border-gray-300"
//           } text-[#3a4043]`}
//           onClick={() =>
//             document.getElementById("resume-upload")?.click()
//           }
//         >
//           Choose File
//         </Button>

//         {resumeFile && (
//           <div className="text-sm text-green-700 mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
//             <p className="mb-2">✓ {resumeFile.name} uploaded successfully</p>
//             <p className="text-xs text-green-600">
//               Your information has been automatically filled in the form
//               below. Please review and update as needed.
//             </p>
//           </div>
//         )}
//       </div>
//     </div>
//   );

//   if (compact) {
//     return uploadContent;
//   }

//   return (
//     <Card className="form-section border-2 border-[#d8d4f0] bg-white rounded-2xl">
//       {showTitle && (
//         <CardHeader>
//           <h2 className="text-[#3a4043]">
//             Resume Upload <span className="text-red-500">*</span>
//           </h2>
//         </CardHeader>
//       )}
//       <CardContent>
//         {uploadContent}
//       </CardContent>
//     </Card>
//   );
// };

// export default ResumeUpload;
