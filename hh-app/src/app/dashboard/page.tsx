"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/app/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/card";
import { Badge } from "@/app/components/badge";
import { 
  User, 
  Building,
  Briefcase, 
  Heart, 
  Settings, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle,
  MapPin,
  DollarSign,
  Bell,
  Shield,
  Eye,
  Star,
  BarChart3,
  Users,
  Plus,
  Edit,
  Trash2,
  MessageSquare,
  Calendar,
  Target,
  Award
} from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "CANDIDATE" | "EMPLOYER";
  profileCompletion?: number;
  accommodations?: string[];
  companyName?: string;
  inclusionScore?: number;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/login');
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6b8a7a] mx-auto mb-4"></div>
          <p className="text-[#3a4043]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!session?.user || !session.user.role) {
    return null; // Will redirect to login
  }

  // Redirect to appropriate dashboard based on role
  if (session.user.role === "CANDIDATE") {
    return <CandidateDashboard user={session.user} activeTab={activeTab} setActiveTab={setActiveTab} />;
  } else {
    return <EmployerDashboard user={session.user} activeTab={activeTab} setActiveTab={setActiveTab} />;
  }
}

// Candidate Dashboard Component
function CandidateDashboard({ 
  user, 
  activeTab, 
  setActiveTab 
}: { 
  user: User; 
  activeTab: string; 
  setActiveTab: (tab: string) => void; 
}) {
  const applications = [
    {
      id: "1",
      jobTitle: "Frontend Developer",
      company: "NeuroTech",
      status: "under_review",
      appliedDate: "2024-01-15",
      accommodationsRequested: true,
    },
    {
      id: "2",
      jobTitle: "UX Designer",
      company: "InclusiveDesign Co",
      status: "interview_scheduled",
      appliedDate: "2024-01-10",
      interviewDate: "2024-01-25"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "under_review":
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Under Review</Badge>;
      case "interview_scheduled":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-800">Interview Scheduled</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 bg-[#6b8a7a] rounded-full flex items-center justify-center text-white font-semibold">
                    {user.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#3a4043]">{user.name}</h3>
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 mt-1">
                      Job Seeker
                    </Badge>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-[#3a4043]">Profile Completion</span>
                    <span className="text-sm font-medium text-[#6b8a7a]">{user.profileCompletion}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#6b8a7a] h-2 rounded-full" 
                      style={{ width: `${user.profileCompletion}%` }}
                    />
                  </div>
                </div>

                <nav className="space-y-2">
                  {[
                    { id: "overview", label: "Overview", icon: BarChart3 },
                    { id: "applications", label: "My Applications", icon: Briefcase },
                    { id: "interviews", label: "Mock Interviews", icon: MessageSquare },
                    { id: "saved", label: "Saved Jobs", icon: Heart },
                    { id: "profile", label: "Profile Settings", icon: Settings },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
                          activeTab === item.id
                            ? 'bg-[#6b8a7a] text-white'
                            : 'text-[#3a4043] hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold text-[#3a4043] mb-2">
                    Welcome back, {user.name.split(' ')[0]}! 👋
                  </h1>
                  <p className="text-gray-600">Here's your job search activity and recommendations.</p>
                </div>

                <div className="grid md:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Briefcase className="h-8 w-8 text-[#6b8a7a] mx-auto mb-2" />
                      <h3 className="font-semibold text-[#3a4043] mb-1">{applications.length}</h3>
                      <p className="text-sm text-gray-600">Applications</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Eye className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-[#3a4043] mb-1">12</h3>
                      <p className="text-sm text-gray-600">Profile Views</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-6 text-center">
                      <Heart className="h-8 w-8 text-red-500 mx-auto mb-2" />
                      <h3 className="font-semibold text-[#3a4043] mb-1">5</h3>
                      <p className="text-sm text-gray-600">Saved Jobs</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6 text-center">
                      <MessageSquare className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                      <h3 className="font-semibold text-[#3a4043] mb-1">3</h3>
                      <p className="text-sm text-gray-600">Mock Interviews</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <Link href="/opportunities">
                        <Button variant="outline" className="w-full">
                          <Briefcase className="h-4 w-4 mr-2" />
                          Browse Jobs
                        </Button>
                      </Link>
                      <Link href="/mock-interview">
                        <Button variant="outline" className="w-full">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Practice Interview
                        </Button>
                      </Link>
                      <Link href="/discover">
                        <Button variant="outline" className="w-full">
                          <Target className="h-4 w-4 mr-2" />
                          Take Assessment
                        </Button>
                      </Link>
                      <Button variant="outline" className="w-full">
                        <Award className="h-4 w-4 mr-2" />
                        View Certificates
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Applications */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Applications</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {applications.map((app) => (
                        <div key={app.id} className="flex items-center justify-between p-4 border border-[#e8e6f0] rounded-lg">
                          <div>
                            <h4 className="font-medium text-[#3a4043]">{app.jobTitle}</h4>
                            <p className="text-sm text-gray-600">{app.company}</p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(app.status)}
                            <p className="text-xs text-gray-500 mt-1">Applied {app.appliedDate}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === "interviews" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h1 className="text-2xl font-bold text-[#3a4043]">Mock Interview Practice</h1>
                  <Link href="/mock-interview">
                    <Button className="bg-[#6b8a7a] hover:bg-[#5d7c6b]">
                      <Plus className="h-4 w-4 mr-2" />
                      New Session
                    </Button>
                  </Link>
                </div>

                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-6xl mb-4">🤖</div>
                    <h3 className="text-xl font-semibold text-[#3a4043] mb-2">AI Interview Coach</h3>
                    <p className="text-gray-600 mb-6">
                      Practice interviews with our neurodivergent-friendly AI coach. Get personalized feedback 
                      and build confidence in a safe, judgment-free environment.
                    </p>
                    <Link href="/mock-interview">
                      <Button className="bg-[#6b8a7a] hover:bg-[#5d7c6b]" size="lg">
                        Start Mock Interview
                      </Button>
                    </Link>
                  </CardContent>
                </Card>

                {/* Interview History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Previous Sessions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-[#e8e6f0] rounded-lg">
                        <div>
                          <h4 className="font-medium text-[#3a4043]">General Interview Practice</h4>
                          <p className="text-sm text-gray-600">Duration: 15 minutes • Score: 85%</p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Completed</Badge>
                          <p className="text-xs text-gray-500 mt-1">2 days ago</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Other tabs would go here... */}
          </div>
        </div>
      </div>
    </div>
  );
}

// Employer Dashboard Component
function EmployerDashboard({ 
  user, 
  activeTab, 
  setActiveTab 
}: { 
  user: User; 
  activeTab: string; 
  setActiveTab: (tab: string) => void; 
}) {
  const router = useRouter();
  
  // Auto-redirect employers to the full employer dashboard
  React.useEffect(() => {
    if (user.role === "EMPLOYER") {
      router.push("/employer-dashboard");
    }
  }, [router, user.role]);
  
  return (
    <div className="min-h-screen bg-[#faf9f7] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#6b8a7a] mx-auto mb-4"></div>
        <p className="text-[#3a4043]">Redirecting to Employer Dashboard...</p>
      </div>
    </div>
  );
}
