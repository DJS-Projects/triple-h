import NextAuth from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: "CANDIDATE" | "EMPLOYER" | "JOB_COACH"
      image?: string
    }
  }

  interface User {
    id: string
    name: string
    email: string
    role: "CANDIDATE" | "EMPLOYER" | "JOB_COACH"
    image?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "CANDIDATE" | "EMPLOYER" | "JOB_COACH"
  }
}




export type UserRole = 'candidate' | 'coach' | 'employer' | null;
export type Theme = 'blue' | 'green' | 'purple' | 'pastel';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  location: string;
  type: string;
  posted: string;
}

export interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  status: 'pending' | 'reviewing' | 'accepted' | 'rejected';
  appliedDate: string;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  progress: number;
  nextSession: string;
}

export interface Message {
  id: string;
  from: string;
  text: string;
  timestamp: string;
}

