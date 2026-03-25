"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Define a type for the candidate profile structure for better type safety
interface CandidateProfile {
  id: string;
  name: string;
  title: string;
  location: string;
  experience: string; // Derived string (e.g., "5 years")
  skills: string[]; // Derived array (e.g., ["React", "Node.js"])
  status: string;
  matchScore: number | undefined;
  lastActive: string;
  accommodationsRequested: boolean;
  accommodationDetails: string; // Derived string

  portfolio: string;
  resume: string;
  appliedJobs: any[]; // Derived array
  availability: string;
  salaryExpectation: string;
  workStyle: string;
  neurodivergentStrengths: string[]; // Derived array

  // New fields directly from the SQLAlchemy model
  user_id?: number; // Optional as it might not always be displayed or present
  candidate_email: string;
  profile_completion: number;
  raw_accommodations?: any[]; // The raw array of accommodations (JSON type in model)
  raw_preferences?: any; // The raw JSON object for preferences
  raw_personal_identifiers?: any; // The raw JSON object for personal_identifiers
  raw_education?: any; // The raw JSON object for education
  raw_experience?: any; // The raw JSON object for experience (work experience data)
  raw_skills?: any; // The raw JSON object for skills (skills data)
  raw_language_proficiencies?: any; // The raw JSON object for language_proficiencies
  raw_environment?: any; // The raw JSON object for environment
  raw_neurodivergent_strengths?: any; // The raw JSON object for neurodivergent_strengths
  raw_applications?: any; // The raw JSON object for applications
  raw_saved_jobs?: any; // The raw JSON object for saved_jobs
  created_at: string;
  updated_at: string;
}

// NEW: Define a type for Employer Profiles (Job Postings)
interface EmployerProfile {
  id: number;
  employer_email: string;
  job_title: string;
  job_type: string;
  work_mode: string;
  experience_level: string;
  location: string;
  salary_range: number; // This is the integer code
  job_summary: string;
  job_requirements: string | null;
  soft_skills: string | null;
  flexible_work_hour: boolean;
  sensory_friendly_environment: boolean;
  peer_support_system: boolean;
  dedicated_workspace: boolean;
  neurodiversity_awareness_training: boolean;
  regular_supervisor_check_in: boolean;
  zero_tolerance_bullying_mobbing_policy: boolean;
  augmentative_alternative_communication: boolean;
  quiet_room: boolean;
  sensory_aids: boolean;
  provide_visual_guidance: boolean;
  uses_project_management_tools: boolean;
  optional_social_event: boolean;
  mental_health_support: boolean;
  near_public_transport: boolean;
  created_at: string;
  updated_at: string;
}


export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // State for candidate profiles
  const [candidates, setCandidates] = useState<CandidateProfile[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true); // Renamed for clarity
  const [errorCandidates, setErrorCandidates] = useState<string | null>(null); // Renamed for clarity

  // NEW: State for employer profiles
  const [employerProfiles, setEmployerProfiles] = useState<EmployerProfile[]>([]);
  const [isLoadingEmployers, setIsLoadingEmployers] = useState(true);
  const [errorEmployers, setErrorEmployers] = useState<string | null>(null);


  // Optional: Redirect unauthenticated users back to the login page
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  // Effect to fetch candidate profiles
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        setIsLoadingCandidates(true); // Use specific loading state
        setErrorCandidates(null); // Use specific error state
        const res = await fetch("http://127.0.0.1:8000/profiles/all/candidate-profiles");
        if (!res.ok) throw new Error(`Failed to fetch candidate profiles: ${res.status}`);
        const data = await res.json();
        const mapped: CandidateProfile[] = (Array.isArray(data) ? data : []).map((p: any) => {
          // Derived fields (existing logic)
          const hardSkills = (p.exp_skill?.HardSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const softSkills = (p.exp_skill?.SoftSkills || "").split(",").map((s: string) => s.trim()).filter(Boolean);
          const skills = [...new Set([...hardSkills, ...softSkills])];
          const strengths = Object.entries(p.environment || {})
            .filter(([_, v]) => {
              if (typeof v === "string") return v.trim().length > 0;
              if (v === null || v === undefined) return false;
              return Boolean(v);
            })
            .map(([k]) => k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim());
          const accommodationsRequested = Array.isArray(p.accommodations) && p.accommodations.length > 0;

          return {
            id: String(p.id ?? p.email ?? Math.random().toString(36).slice(2)),
            name: p.name ?? "Unnamed",
            title: p.exp_skill?.RoleTitle ?? "Candidate",
            location: p.location ?? "",
            experience: p.exp_skill?.YearsInRole ? `${p.exp_skill.YearsInRole} years` : "",
            skills, // Derived from p.exp_skill
            status: "available", // Default or derive from data if available
            matchScore: undefined, // Derive from data if available
            lastActive: "", // Derive from data if available
            accommodationsRequested,
            accommodationDetails: accommodationsRequested ? (Array.isArray(p.accommodations) ? p.accommodations.join(", ") : String(p.accommodations)) : "",
            portfolio: p.personal_identifiers?.linkedin ?? "",
            resume: p.personal_identifiers?.resume_link ?? "", // Assuming a field for resume link
            appliedJobs: [], // Placeholder, populate if p.applications has a known array structure
            availability: p.job_preferences?.availability ?? "",
            salaryExpectation: p.job_preferences?.salary_expectation ?? "", // Assuming a field for salary expectation
            workStyle: p.preferences?.workType ?? "",
            neurodivergentStrengths: strengths, // Derived from p.environment

            // New fields directly from the SQLAlchemy model
            user_id: p.user_id,
            candidate_email: p.candidate_email ?? "",
            profile_completion: p.profile_completion ?? 0,
            raw_accommodations: p.accommodations, // The raw JSON array
            raw_preferences: p.preferences, // The raw JSON object
            raw_personal_identifiers: p.personal_identifiers, // The raw JSON object
            raw_education: p.education, // The raw JSON object
            raw_experience: p.experience, // The raw JSON object (work experience data)
            raw_skills: p.skills, // The raw JSON object (skills data)
            raw_language_proficiencies: p.language_proficiencies, // The raw JSON object
            raw_environment: p.environment, // The raw JSON object
            raw_neurodivergent_strengths: p.neurodivergent_strengths, // The raw JSON object
            raw_applications: p.applications, // The raw JSON object
            raw_saved_jobs: p.saved_jobs, // The raw JSON object
            created_at: p.created_at ?? "",
            updated_at: p.updated_at ?? "",
          };
        });
        setCandidates(mapped);
      } catch (err: any) {
        setErrorCandidates(err.message || "Failed to load candidates");
      } finally {
        setIsLoadingCandidates(false);
      }
    };
    fetchCandidates();
  }, []); // Empty dependency array to run once on mount

  // NEW: Effect to fetch employer profiles
  useEffect(() => {
    const fetchEmployerProfiles = async () => {
      try {
        setIsLoadingEmployers(true);
        setErrorEmployers(null);
        const res = await fetch("http://127.0.0.1:8000/company/all/employer-profiles"); // Correct endpoint
        if (!res.ok) throw new Error(`Failed to fetch employer profiles: ${res.status}`);
        const data = await res.json();
        // Assuming data is already an array of EmployerProfile objects
        setEmployerProfiles(data);
      } catch (err: any) {
        setErrorEmployers(err.message || "Failed to load employer profiles");
      } finally {
        setIsLoadingEmployers(false);
      }
    };
    fetchEmployerProfiles();
  }, []); // Empty dependency array to run once on mount


  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-gray-700">Loading session...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-lg text-red-500">You are not logged in. Redirecting...</p>
      </div>
    );
  }

  // Helper function to render JSON data (or just text for boolean flags)
  const renderDetail = (label: string, data: any) => {
    if (data === null || data === undefined || (typeof data === 'string' && data.trim() === '')) {
      return null;
    }
    if (typeof data === 'boolean') {
      return (
        <p className="text-gray-600 text-sm">
          <strong>{label}:</strong> {data ? "Yes" : "No"}
        </p>
      );
    }
    if (typeof data === 'object') {
      // For objects, use the JSON rendering
      return (
        <div className="mt-2 text-gray-600 text-sm">
          <strong>{label}:</strong>
          <pre className="bg-gray-100 p-2 rounded-md text-xs overflow-auto">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      );
    }
    // For other types (string, number), just display directly
    return (
      <p className="text-gray-600 text-sm">
        <strong>{label}:</strong> {String(data)}
      </p>
    );
  };

  // NEW: Helper function to format salary range
  const formatSalaryRange = (rangeCode: number | undefined): string => {
    if (rangeCode === undefined || rangeCode === null) {
      return "N/A";
    }
    switch (rangeCode) {
      case 1: return "Below RM 3,000";
      case 2: return "RM 3,000 - RM 5,000";
      case 3: return "RM 5,001 - RM 8,000";
      case 4: return "RM 8,001 - RM 12,000";
      case 5: return "RM 12,001 - RM 18,000";
      case 6: return "RM 18,001 - RM 25,000";
      case 7: return "Above RM 25,000";
      default: return `Unknown (Code: ${rangeCode})`;
    }
  };


  // If status is "authenticated", session.user will contain the data
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto bg-white p-6 rounded-lg shadow-md"> {/* Increased max-width */}
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Welcome to Your Dashboard!</h1>

        {session?.user ? (
          <div className="space-y-4 mb-8 p-4 bg-gray-50 rounded-md border border-gray-200">
            <p className="text-lg text-gray-700">
              Hello, <span className="font-semibold">{session.user.name || session.user.email}</span>!
            </p>
            <p className="text-gray-600">
              Your Email: <span className="font-medium">{session.user.email}</span>
            </p>
            <p className="text-gray-600">
              Your Role: <span className="font-medium">{session.user.role}</span>
            </p>
            <p className="text-gray-600">
              Your User ID: <span className="font-medium">{session.user.id}</span>
            </p>
          </div>
        ) : (
          <p className="text-lg text-gray-700 mb-8">Session data not found.</p>
        )}

        {/* Candidate Profiles Section */}
        <div className="mt-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Candidate Profiles</h2>
          {isLoadingCandidates ? (
            <p className="text-lg text-gray-700">Loading candidate profiles...</p>
          ) : errorCandidates ? (
            <p className="text-lg text-red-500">Error: {errorCandidates}</p>
          ) : candidates.length === 0 ? (
            <p className="text-lg text-gray-700">No candidate profiles found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {candidates.map((candidate) => (
                <div key={candidate.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                  <div>
                    {<p className="text-gray-600 text-xs mt-2"><strong>Candidate Name:</strong> {candidate.raw_personal_identifiers.fullName}</p>}
                    {<p className="text-gray-600 text-xs mt-2"><strong>NRIC:</strong> {candidate.raw_personal_identifiers.nric}</p>}
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Education:</strong>
                      {Array.isArray(candidate.raw_education) && candidate.raw_education.length > 0 ? (
                        <ul className="list-disc ml-4">
                          {candidate.raw_education.map((edu: any, index: number) => (
                            <li key={edu.id || index}>
                              {edu.level && <span>{edu.level}</span>}
                              {edu.fieldOfStudy && <span> in {edu.fieldOfStudy}</span>}
                              {edu.institution && <span> from {edu.institution}</span>}
                              {edu.graduationYear && <span> ({edu.graduationYear})</span>}
                              {edu.cgpa_grade && <span> – CGPA: {edu.cgpa_grade}</span>}
                              {edu.award && <span> – {edu.award}</span>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span> No education data </span>
                      )}
                    </div>
                    }
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Experience:</strong>
                      {Array.isArray(candidate.raw_experience) && candidate.raw_experience.length > 0 ? (
                        <ul className="list-disc ml-4">
                          {candidate.raw_experience.map((exp: any) => (
                            <li key={exp.id} className="mb-1">
                              {exp.Title && <span className="font-medium">{exp.Title}</span>}
                              {exp.employer && <span> at {exp.employer}</span>}
                              {exp.start && (
                                <span>
                                  {" "}
                                  ({exp.start} – {exp.isCurrent ? "Present" : exp.end || "N/A"})
                                </span>
                              )}
                              {exp.ProjectHighlights && (
                                <div className="ml-2 text-gray-500">
                                  <strong>Projects:</strong> {exp.ProjectHighlights}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span> No experience data </span>
                      )}
                    </div>
                    }   
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Skills:</strong>
                      {candidate.raw_skills ? (
                        <div className="ml-4">
                          {candidate.raw_skills.HardSkills && candidate.raw_skills.HardSkills.length > 0 && (
                            <div>
                              <strong>Hard Skills:</strong>
                              <ul className="list-disc ml-4">
                                {candidate.raw_skills.HardSkills.map((skill: string, index: number) => (
                                  <li key={index}>{skill}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {candidate.raw_skills.SoftSkills && candidate.raw_skills.SoftSkills.length > 0 && (
                            <div className="mt-1">
                              <strong>Soft Skills:</strong>
                              <ul className="list-disc ml-4">
                                {candidate.raw_skills.SoftSkills.map((skill: string, index: number) => (
                                  <li key={index}>{skill}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span> No skills data </span>
                      )}
                    </div>
                    }    
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Language Proficiencies:</strong>
                      {Array.isArray(candidate.raw_language_proficiencies) &&
                      candidate.raw_language_proficiencies.length > 0 ? (
                        <ul className="list-disc ml-4">
                          {candidate.raw_language_proficiencies.map((lang: any, index: number) => (
                            <li key={index}>
                              <span className="font-medium">{lang.language}</span> — 
                              Reading: {lang.reading}, Writing: {lang.writing}, Listening: {lang.listening}, Speaking: {lang.speaking}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span> No language proficiency data </span>
                      )}
                    </div>
                    }
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Environment:</strong>
                      {candidate.raw_environment ? (
                        <ul className="list-disc ml-4">
                          {Object.entries(candidate.raw_environment)
                            .filter(([_, value]) => value) // show only non-empty values
                            .map(([key, value]) => (
                              <li key={key}>
                                <strong>{key}:</strong> {String(value)}
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <span> No environment data </span>
                      )}
                    </div>
                    }
                    {<div className="text-gray-600 text-xs mt-2">
                      <strong>Neurodivergent Strengths:</strong>
                      {Array.isArray(candidate.raw_neurodivergent_strengths) &&
                      candidate.raw_neurodivergent_strengths.length > 0 ? (
                        <ul className="list-disc ml-4">
                          {candidate.raw_neurodivergent_strengths.map((strength: string, index: number) => (
                            <li key={index}>{strength}</li>
                          ))}
                        </ul>
                      ) : (
                        <span> No neurodivergent strengths data </span>
                      )}
                    </div>
                    }                                                                                               
                    {/* Timestamps */}
                    {candidate.created_at && <p className="text-gray-600 text-xs mt-2"><strong>Created At:</strong> {new Date(candidate.created_at).toLocaleString()}</p>}
                    {candidate.updated_at && <p className="text-gray-600 text-xs"><strong>Updated At:</strong> {new Date(candidate.updated_at).toLocaleString()}</p>}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    {candidate.portfolio && (
                      <a href={candidate.portfolio} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm block">
                        View LinkedIn Profile
                      </a>
                    )}
                    {candidate.resume && (
                      <a href={candidate.resume} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-sm block">
                        View Resume
                      </a>
                    )}
                    {candidate.appliedJobs.length > 0 && (
                      <p className="text-gray-600 text-sm">Applied to {candidate.appliedJobs.length} jobs</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NEW: Employer Profiles (Job Postings) Section */}
        <div className="mt-12"> {/* Added more top margin to separate sections */}
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Employer Profiles (Job Postings)</h2>
          {isLoadingEmployers ? (
            <p className="text-lg text-gray-700">Loading employer profiles...</p>
          ) : errorEmployers ? (
            <p className="text-lg text-red-500">Error: {errorEmployers}</p>
          ) : employerProfiles.length === 0 ? (
            <p className="text-lg text-gray-700">No employer profiles (job postings) found.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employerProfiles.map((job) => (
                <div key={job.id} className="bg-gray-50 p-4 rounded-lg shadow-sm border border-gray-200 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{job.job_title}</h3>
                    <p className="text-gray-700 text-sm mb-2">Employer: {job.employer_email}</p>

                    {renderDetail("Job ID", job.id)}
                    {renderDetail("Job Type", job.job_type)}
                    {renderDetail("Work Mode", job.work_mode)}
                    {renderDetail("Experience Level", job.experience_level)}
                    {renderDetail("Location", job.location)}
                    {/* UPDATED: Use formatSalaryRange helper */}
                    {renderDetail("Salary Range", formatSalaryRange(job.salary_range))}
                    {renderDetail("Job Summary", job.job_summary)}
                    {renderDetail("Job Requirements", job.job_requirements)}
                    {renderDetail("Soft Skills", job.soft_skills)}

                    <h4 className="text-md font-semibold text-gray-800 mt-4 mb-2">Workplace Accommodations:</h4>
                    {renderDetail("Flexible Work Hour", job.flexible_work_hour)}
                    {renderDetail("Sensory Friendly Environment", job.sensory_friendly_environment)}
                    {renderDetail("Peer Support System", job.peer_support_system)}
                    {renderDetail("Dedicated Workspace", job.dedicated_workspace)}
                    {renderDetail("Neurodiversity Awareness Training", job.neurodiversity_awareness_training)}
                    {renderDetail("Regular Supervisor Check-in", job.regular_supervisor_check_in)}
                    {renderDetail("Zero Tolerance Bullying/Mobbing Policy", job.zero_tolerance_bullying_mobbing_policy)}
                    {renderDetail("Augmentative Alternative Communication", job.augmentative_alternative_communication)}
                    {renderDetail("Quiet Room", job.quiet_room)}
                    {renderDetail("Sensory Aids", job.sensory_aids)}
                    {renderDetail("Provide Visual Guidance", job.provide_visual_guidance)}
                    {renderDetail("Uses Project Management Tools", job.uses_project_management_tools)}
                    {renderDetail("Optional Social Event", job.optional_social_event)}
                    {renderDetail("Mental Health Support", job.mental_health_support)}
                    {renderDetail("Near Public Transport", job.near_public_transport)}

                    {/* Timestamps */}
                    {job.created_at && <p className="text-gray-600 text-xs mt-2"><strong>Posted At:</strong> {new Date(job.created_at).toLocaleString()}</p>}
                    {job.updated_at && <p className="text-gray-600 text-xs"><strong>Last Updated:</strong> {new Date(job.updated_at).toLocaleString()}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        <button
          onClick={() => router.push("/")} // Example: Go to home page
          className="mt-8 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
        >
          Go to Home
        </button>
      </div>
    </div>
  );
}
