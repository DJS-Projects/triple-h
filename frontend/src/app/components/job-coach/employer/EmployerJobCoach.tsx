"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { 
  Users, 
  Calendar, 
  FileText, 
  CheckCircle, 
  Lightbulb, 
  Shield, 
  BarChart3, 
  MessageCircle, 
  BookOpen, 
  Target,
  Star,
  TrendingUp,
  Heart,
  Award,
  Clock,
  Download,
  ExternalLink
} from 'lucide-react';

export function EmployerJobCoach() {
  const [activeTab, setActiveTab] = useState('hiring-support');

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Users className="w-5 h-5 text-[#635bff]" />
            Employer Job Coach
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Build inclusive hiring practices and create supportive workplaces for neurodivergent talent
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl border border-[#e8e6f0] p-1">
          <TabsTrigger value="hiring-support" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4" />
            Inclusive Hiring
          </TabsTrigger>
          <TabsTrigger value="workplace-inclusion" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Workplace Inclusion
          </TabsTrigger>
          <TabsTrigger value="progress-feedback" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Progress & Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hiring-support" className="space-y-6">
          <InclusiveHiringSupport />
        </TabsContent>

        <TabsContent value="workplace-inclusion" className="space-y-6">
          <WorkplaceInclusion />
        </TabsContent>

        <TabsContent value="progress-feedback" className="space-y-6">
          <ProgressFeedback />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InclusiveHiringSupport() {
  const [showBooking, setShowBooking] = useState(false);

  const interviewGuide = [
    {
      section: "Pre-Interview Preparation",
      tips: [
        "Provide interview questions in advance when possible",
        "Share the interview format and timeline clearly",
        "Offer alternative communication methods (written, video, in-person)",
        "Ensure the interview space is sensory-friendly"
      ]
    },
    {
      section: "During the Interview",
      tips: [
        "Allow extra time for processing questions",
        "Use clear, direct language and avoid idioms",
        "Provide visual aids or written materials when helpful",
        "Be patient and allow for pauses in conversation"
      ]
    },
    {
      section: "Post-Interview",
      tips: [
        "Provide written feedback and next steps",
        "Follow up within the promised timeframe",
        "Offer to answer any questions about the role or company",
        "Be transparent about the decision-making process"
      ]
    }
  ];

  const jobPostingChecklist = [
    {
      category: "Job Description",
      items: [
        "Use clear, jargon-free language",
        "Focus on essential vs. nice-to-have requirements",
        "Include specific examples of tasks and responsibilities",
        "Mention available accommodations upfront"
      ]
    },
    {
      category: "Application Process",
      items: [
        "Offer multiple ways to apply (online, email, phone)",
        "Provide clear instructions for each step",
        "Allow alternative formats for resumes and cover letters",
        "Set realistic deadlines and communicate them clearly"
      ]
    },
    {
      category: "Interview Process",
      items: [
        "Offer flexible interview formats",
        "Provide interview questions in advance",
        "Include neurodivergent team members in interviews",
        "Train interviewers on inclusive practices"
      ]
    },
    {
      category: "Onboarding",
      items: [
        "Create detailed onboarding schedules",
        "Assign a mentor or buddy",
        "Provide written documentation of processes",
        "Schedule regular check-ins during the first month"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Book a Job Coach */}
      <Card className="border border-[#e8e6f0] bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Calendar className="w-5 h-5 text-[#635bff]" />
            Book a Job Coach Session
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Get personalized guidance on inclusive hiring practices from our expert coaches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-[#3a4043]">What you'll get:</h4>
              <ul className="space-y-2 text-sm text-[#6f7a80]">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Personalized hiring strategy review
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Interview process optimization
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Accommodation planning guidance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Follow-up support and resources
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-[#e8e6f0] rounded-lg p-4">
                <h5 className="font-medium text-[#3a4043] mb-2">Session Options</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>30-minute consultation</span>
                    <span className="font-medium">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1-hour strategy session</span>
                    <span className="font-medium">$150</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ongoing coaching package</span>
                    <span className="font-medium">$500/month</span>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full bg-[#635bff] hover:bg-[#524aff] text-white"
                onClick={() => setShowBooking(true)}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Book Your Session
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interview Guide */}
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <FileText className="w-5 h-5 text-[#635bff]" />
            Interview Guide for Neurodivergent Candidates
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Best practices for conducting inclusive interviews
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {interviewGuide.map((section, index) => (
              <div key={index} className="border border-[#e8e6f0] rounded-lg p-4 bg-gradient-to-r from-white to-[#635bff]/5">
                <h4 className="font-medium text-[#3a4043] mb-3">{section.section}</h4>
                <div className="space-y-2">
                  {section.tips.map((tip, tipIndex) => (
                    <div key={tipIndex} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-[#635bff] flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-[#6f7a80]">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inclusive Job Posting Checklist */}
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <CheckCircle className="w-5 h-5 text-[#635bff]" />
            Inclusive Job Posting Checklist
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Ensure your job postings attract and welcome neurodivergent candidates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {jobPostingChecklist.map((category, index) => (
              <div key={index} className="space-y-3">
                <h4 className="font-medium text-[#3a4043] flex items-center gap-2">
                  <Target className="w-4 h-4 text-[#635bff]" />
                  {category.category}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {category.items.map((item, itemIndex) => (
                    <div key={itemIndex} className="flex items-start gap-2 p-3 border border-[#e8e6f0] rounded-lg bg-white">
                      <input type="checkbox" className="mt-1" />
                      <span className="text-sm text-[#6f7a80]">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-6 p-4 bg-[#635bff]/5 border border-[#635bff]/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="w-4 h-4 text-[#635bff]" />
                <span className="font-medium text-[#3a4043]">Pro Tip</span>
              </div>
              <p className="text-sm text-[#6f7a80]">
                Review this checklist before posting any job. Consider having a neurodivergent team member 
                review your job postings for accessibility and clarity.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkplaceInclusion() {
  const managerToolkit = [
    {
      title: "Understanding Neurodivergence",
      description: "Learn about different neurotypes and their strengths",
      resources: [
        "Neurodivergence 101 Guide",
        "Common Accommodations List",
        "Communication Styles Guide"
      ]
    },
    {
      title: "Team Management",
      description: "Strategies for managing neurodivergent team members",
      resources: [
        "One-on-One Meeting Templates",
        "Feedback Guidelines",
        "Goal Setting Frameworks"
      ]
    },
    {
      title: "Conflict Resolution",
      description: "Addressing misunderstandings and workplace conflicts",
      resources: [
        "Mediation Techniques",
        "Communication Scripts",
        "Escalation Procedures"
      ]
    }
  ];

  const adaptationIdeas = [
    {
      category: "Physical Environment",
      ideas: [
        "Quiet spaces for focused work",
        "Adjustable lighting options",
        "Noise-canceling equipment",
        "Flexible seating arrangements"
      ]
    },
    {
      category: "Work Processes",
      ideas: [
        "Written instructions for complex tasks",
        "Visual project timelines",
        "Regular check-in schedules",
        "Clear deadline communications"
      ]
    },
    {
      category: "Communication",
      ideas: [
        "Multiple communication channels",
        "Meeting agendas in advance",
        "Written summaries of discussions",
        "Alternative to large group meetings"
      ]
    },
    {
      category: "Technology",
      ideas: [
        "Screen reader compatibility",
        "Voice-to-text software",
        "Project management tools",
        "Calendar integration systems"
      ]
    }
  ];

  return (
    <div className="space-y-6">
      {/* Manager Toolkit */}
      <Card className="border border-[#e8e6f0] bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <BookOpen className="w-5 h-5 text-[#635bff]" />
            Manager Toolkit
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Essential resources for managing neurodivergent team members effectively
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-6">
            {managerToolkit.map((tool, index) => (
              <Card key={index} className="border border-[#e8e6f0] bg-white">
                <CardHeader>
                  <CardTitle className="text-lg">{tool.title}</CardTitle>
                  <CardDescription>{tool.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tool.resources.map((resource, resourceIndex) => (
                      <div key={resourceIndex} className="flex items-center gap-2 text-sm">
                        <FileText className="w-3 h-3 text-[#635bff]" />
                        <span className="text-[#6f7a80]">{resource}</span>
                      </div>
                    ))}
                  </div>
                  <Button size="sm" className="w-full mt-4 bg-[#635bff] hover:bg-[#524aff] text-white">
                    <Download className="w-3 h-3 mr-2" />
                    Download Toolkit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Workplace Adaptation Ideas */}
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Lightbulb className="w-5 h-5 text-[#635bff]" />
            Workplace Adaptation Ideas
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Practical suggestions for creating an inclusive workplace environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {adaptationIdeas.map((category, index) => (
              <div key={index} className="space-y-3">
                <h4 className="font-medium text-[#3a4043] flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#635bff]" />
                  {category.category}
                </h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {category.ideas.map((idea, ideaIndex) => (
                    <div key={ideaIndex} className="flex items-start gap-2 p-3 border border-[#e8e6f0] rounded-lg bg-gradient-to-r from-white to-[#635bff]/5">
                      <CheckCircle className="w-4 h-4 text-[#635bff] flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-[#6f7a80]">{idea}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Consult with a Coach */}
      <Card className="border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <MessageCircle className="w-5 h-5 text-[#635bff]" />
            Consult with a Coach
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Get personalized advice on workplace inclusion challenges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-medium text-[#3a4043]">Common Consultation Topics:</h4>
              <ul className="space-y-2 text-sm text-[#6f7a80]">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Team dynamics and communication
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Accommodation planning and implementation
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Performance management strategies
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  Creating inclusive team culture
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <div className="bg-white border border-[#e8e6f0] rounded-lg p-4">
                <h5 className="font-medium text-[#3a4043] mb-2">Consultation Options</h5>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Quick question (15 min)</span>
                    <span className="font-medium">Free</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Strategy session (1 hour)</span>
                    <span className="font-medium">$200</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Team training session</span>
                    <span className="font-medium">$500</span>
                  </div>
                </div>
              </div>
              <Button className="w-full bg-[#635bff] hover:bg-[#524aff] text-white">
                <MessageCircle className="w-4 h-4 mr-2" />
                Schedule Consultation
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProgressFeedback() {
  const inclusionScore = 85;
  const scoreBreakdown = [
    { category: "Hiring Practices", score: 90, maxScore: 100 },
    { category: "Workplace Accommodations", score: 85, maxScore: 100 },
    { category: "Team Training", score: 80, maxScore: 100 },
    { category: "Communication", score: 88, maxScore: 100 },
    { category: "Inclusive Culture", score: 82, maxScore: 100 }
  ];

  const recentFeedback = [
    {
      date: "2024-01-20",
      coach: "Dr. Sarah Chen",
      type: "Hiring Process Review",
      feedback: "Your job postings are well-structured and inclusive. Consider adding more specific accommodation information.",
      rating: 4
    },
    {
      date: "2024-01-15",
      coach: "Mike Rodriguez",
      type: "Team Management",
      feedback: "Great progress on team communication. The weekly check-ins are working well for your neurodivergent team members.",
      rating: 5
    }
  ];

  const learningResources = [
    {
      title: "Neurodivergent Leadership Best Practices",
      type: "Video Course",
      duration: "2 hours",
      progress: 75
    },
    {
      title: "Inclusive Communication Strategies",
      type: "Interactive Guide",
      duration: "1 hour",
      progress: 100
    },
    {
      title: "Accommodation Planning Workshop",
      type: "Live Session",
      duration: "3 hours",
      progress: 0
    }
  ];

  return (
    <div className="space-y-6">
      {/* Inclusion Readiness Score */}
      <Card className="border border-[#e8e6f0] bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <BarChart3 className="w-5 h-5 text-[#635bff]" />
            Inclusion Readiness Score
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Track your progress in creating an inclusive workplace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#635bff] mb-2">{inclusionScore}%</div>
              <div className="text-sm text-[#6f7a80] mb-4">Overall Inclusion Score</div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-[#635bff] h-3 rounded-full transition-all duration-500"
                  style={{ width: `${inclusionScore}%` }}
                />
              </div>
              <p className="text-xs text-[#6f7a80] mt-2">
                {inclusionScore >= 90 ? "Excellent!" : inclusionScore >= 70 ? "Good progress" : "Keep improving"}
              </p>
            </div>
            <div className="space-y-3">
              {scoreBreakdown.map((item, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#3a4043]">{item.category}</span>
                    <span className="text-[#6f7a80]">{item.score}/{item.maxScore}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-[#635bff] h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(item.score / item.maxScore) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Coach Feedback Portal */}
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <MessageCircle className="w-5 h-5 text-[#635bff]" />
            Coach Feedback Portal
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Recent feedback and recommendations from your coaches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentFeedback.map((feedback, index) => (
              <div key={index} className="border border-[#e8e6f0] rounded-lg p-4 bg-gradient-to-r from-white to-[#635bff]/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-[#3a4043]">{feedback.type}</h4>
                    <p className="text-sm text-[#6f7a80]">by {feedback.coach} • {feedback.date}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < feedback.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} 
                      />
                    ))}
                  </div>
                </div>
                <p className="text-sm text-[#6f7a80] leading-relaxed">{feedback.feedback}</p>
              </div>
            ))}
            <Button variant="outline" className="w-full border-[#635bff] text-[#635bff] hover:bg-[#635bff]/10">
              <MessageCircle className="w-4 h-4 mr-2" />
              Request New Feedback
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Learning Resources */}
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <BookOpen className="w-5 h-5 text-[#635bff]" />
            Team Learning Resources
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Educational materials for your team to build inclusive practices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {learningResources.map((resource, index) => (
              <div key={index} className="border border-[#e8e6f0] rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-[#3a4043]">{resource.title}</h4>
                    <p className="text-sm text-[#6f7a80]">{resource.type} • {resource.duration}</p>
                  </div>
                  <Badge variant="secondary" className="bg-[#635bff]/10 text-[#635bff]">
                    {resource.progress}% Complete
                  </Badge>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div 
                    className="bg-[#635bff] h-2 rounded-full transition-all duration-500"
                    style={{ width: `${resource.progress}%` }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-[#635bff] hover:bg-[#524aff] text-white">
                    {resource.progress === 0 ? 'Start' : 'Continue'}
                  </Button>
                  <Button size="sm" variant="outline" className="border-[#e8e6f0]">
                    <Download className="w-3 h-3 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







