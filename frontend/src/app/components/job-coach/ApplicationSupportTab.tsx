"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Textarea } from '@/app/components/textarea';
import { Input } from '@/app/components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { FileText, Lightbulb, Download, Eye, Sparkles, CheckCircle, AlertCircle, Upload, Play, Users, MessageCircle } from 'lucide-react';

interface ApplicationSupportTabProps {
  setCurrentPage: (page: string) => void;
}

export function ApplicationSupportTab({ setCurrentPage }: ApplicationSupportTabProps) {
  const [resumeText, setResumeText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activeTab, setActiveTab] = useState('resume');

  const templates = [
    {
      id: 'clean',
      name: 'Clean & Minimal',
      description: 'Distraction-free design with clear sections',
      features: ['High contrast text', 'Spacious layout', 'Easy scanning'],
      icon: <Eye className="w-5 h-5 text-[#635bff]" />
    },
    {
      id: 'structured',
      name: 'Structured Professional',
      description: 'Organized sections with visual hierarchy',
      features: ['Clear headings', 'Consistent formatting', 'Professional tone'],
      icon: <FileText className="w-5 h-5 text-[#635bff]" />
    },
    {
      id: 'skills-focused',
      name: 'Skills-Focused',
      description: 'Highlights technical and soft skills prominently',
      features: ['Skills showcase', 'Achievement focus', 'Industry-specific'],
      icon: <Sparkles className="w-5 h-5 text-[#635bff]" />
    }
  ];

  const aiSuggestions = [
    {
      type: 'strength',
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      title: 'Strong Action Verbs',
      content: 'Great use of "implemented," "optimized," and "collaborated"'
    },
    {
      type: 'improvement',
      icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
      title: 'Quantify Achievements',
      content: 'Add specific numbers: "Reduced processing time by 30%" instead of "Improved efficiency"'
    },
    {
      type: 'improvement',
      icon: <AlertCircle className="w-4 h-4 text-amber-600" />,
      title: 'Skills Section',
      content: 'Consider adding soft skills like "Detail-oriented" and "Systematic problem-solving"'
    },
    {
      type: 'strength',
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      title: 'Clear Format',
      content: 'Well-organized sections make it easy for recruiters to scan'
    }
  ];

  const coverLetterTips = [
    {
      section: 'Opening',
      tip: 'Start with your specific interest in the role and company',
      example: '"I am excited to apply for the Software Developer position at [Company], where I can contribute my systematic approach to problem-solving..."'
    },
    {
      section: 'Body',
      tip: 'Highlight how your neurodivergent strengths align with job requirements',
      example: '"My attention to detail and ability to focus deeply on complex problems has enabled me to..."'
    },
    {
      section: 'Closing',
      tip: 'Express enthusiasm while being authentic about your work style',
      example: '"I thrive in collaborative environments with clear communication and structured processes..."'
    }
  ];

  const mockInterviewFeatures = [
    {
      title: "AI-Powered Practice",
      description: "Practice with our neurodivergent-aware AI interviewer",
      icon: <MessageCircle className="w-5 h-5 text-[#635bff]" />
    },
    {
      title: "Realistic Scenarios",
      description: "Common interview questions with neurodivergent-friendly approaches",
      icon: <Users className="w-5 h-5 text-[#635bff]" />
    },
    {
      title: "Instant Feedback",
      description: "Get immediate suggestions for improvement",
      icon: <Lightbulb className="w-5 h-5 text-[#635bff]" />
    },
    {
      title: "Confidence Building",
      description: "Practice in a safe, supportive environment",
      icon: <CheckCircle className="w-5 h-5 text-[#635bff]" />
    }
  ];

  const handleAnalyzeResume = () => {
    if (resumeText.trim()) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <FileText className="w-5 h-5 text-[#635bff]" />
            Application Support & Preparation
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Build strong applications and practice interviews with confidence
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-xl border border-[#e8e6f0] p-1">
          <TabsTrigger value="resume" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Resume Builder
          </TabsTrigger>
          <TabsTrigger value="interview" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Play className="w-4 h-4" />
            Mock Interview Practice
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resume" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border border-[#e8e6f0] bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                  <Sparkles className="w-5 h-5 text-[#635bff]" />
                  Resume Content
                </CardTitle>
                <CardDescription className="text-[#6f7a80]">
                  Upload or paste your resume for AI-powered suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-[#e8e6f0] rounded-lg p-6 text-center hover:border-[#635bff]/30 transition-colors">
                    <Upload className="w-8 h-8 text-[#6f7a80] mx-auto mb-2" />
                    <p className="text-sm text-[#6f7a80] mb-2">Upload your resume file</p>
                    <Button variant="outline" size="sm" className="border-[#e8e6f0]">
                      Choose File
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-[#e8e6f0]" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-[#6f7a80]">Or</span>
                    </div>
                  </div>
                </div>

                <Textarea
                  placeholder="Paste your resume content here..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[300px] focus:ring-[#635bff]/20 focus:border-[#635bff]/30"
                />
                <Button 
                  onClick={handleAnalyzeResume}
                  disabled={!resumeText.trim()}
                  className="w-full bg-[#635bff] hover:bg-[#524aff] text-white"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Get AI Suggestions
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-[#e8e6f0] bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                  <Eye className="w-5 h-5 text-[#635bff]" />
                  AI Feedback
                </CardTitle>
                <CardDescription className="text-[#6f7a80]">
                  Personalized suggestions for improvement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showSuggestions ? (
                  <div className="space-y-4">
                    {aiSuggestions.map((suggestion, index) => (
                      <div key={index} className="border border-[#e8e6f0] rounded-lg p-4 bg-gradient-to-r from-white to-[#635bff]/5">
                        <div className="flex items-start gap-3">
                          {suggestion.icon}
                          <div className="space-y-1">
                            <h4 className="font-medium text-sm text-[#3a4043]">{suggestion.title}</h4>
                            <p className="text-sm text-[#6f7a80] leading-relaxed">
                              {suggestion.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2 pt-4">
                      <Button size="sm" variant="outline" className="border-[#e8e6f0]">
                        <Download className="w-4 h-4 mr-2" />
                        Export Suggestions
                      </Button>
                      <Button size="sm" className="bg-[#635bff] hover:bg-[#524aff] text-white">
                        Apply Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <Lightbulb className="w-12 h-12 text-[#6f7a80] mx-auto" />
                    <p className="text-[#6f7a80]">
                      Upload your resume or paste content to receive personalized feedback.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Resume Templates Section */}
          <Card className="border border-[#e8e6f0] bg-card">
            <CardHeader>
              <CardTitle className="text-[#3a4043]">Neurodivergent-Friendly Resume Templates</CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Choose a template designed for clarity and easy scanning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`border cursor-pointer transition-all duration-200 hover:shadow-lg ${
                      selectedTemplate === template.id ? 'border-[#635bff] bg-[#635bff]/5' : 'border-[#e8e6f0] bg-gradient-to-br from-white to-[#635bff]/5'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-2 mb-2">
                        {template.icon}
                        <CardTitle className="text-lg text-[#3a4043]">{template.name}</CardTitle>
                      </div>
                      <CardDescription className="text-[#6f7a80]">{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {template.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-[#635bff]" />
                            <span className="text-sm text-[#3a4043]">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1 border-[#e8e6f0]">
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        <Button size="sm" className="flex-1 bg-[#635bff] hover:bg-[#524aff] text-white">
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Cover Letter Tips */}
          <Card className="border border-[#e8e6f0] bg-card">
            <CardHeader>
              <CardTitle className="text-[#3a4043]">Cover Letter Guide</CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Write compelling cover letters that highlight your neurodivergent strengths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {coverLetterTips.map((tip, index) => (
                  <div key={index} className="border border-[#e8e6f0] rounded-lg p-4 bg-gradient-to-r from-white to-[#635bff]/5">
                    <div className="space-y-3">
                      <h4 className="font-medium text-[#3a4043]">{tip.section} Paragraph</h4>
                      <p className="text-sm text-[#6f7a80] leading-relaxed">{tip.tip}</p>
                      <div className="bg-white border border-[#e8e6f0] rounded p-3">
                        <p className="text-sm text-[#3a4043] italic">{tip.example}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Card className="border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-[#3a4043] mb-2">💡 Neurodivergent-Friendly Tips</h4>
                    <ul className="space-y-1 text-sm text-[#6f7a80]">
                      <li>• Be authentic about your work style preferences</li>
                      <li>• Highlight systematic thinking and attention to detail</li>
                      <li>• Mention your ability to focus deeply on complex problems</li>
                      <li>• Show how you bring unique perspectives to teams</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Button className="w-full bg-[#635bff] hover:bg-[#524aff] text-white">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Cover Letter Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interview" className="space-y-6">
          <Card className="border border-[#e8e6f0] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Play className="w-5 h-5 text-[#635bff]" />
                Mock Interview Practice
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Practice interviews in a safe, supportive environment with neurodivergent-aware feedback
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {mockInterviewFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3 p-4 border border-[#e8e6f0] rounded-lg bg-gradient-to-r from-white to-[#635bff]/5">
                    <div className="p-2 bg-[#635bff]/10 rounded-lg">
                      {feature.icon}
                    </div>
                    <div>
                      <h4 className="font-medium text-[#3a4043] mb-1">{feature.title}</h4>
                      <p className="text-sm text-[#6f7a80]">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-[#635bff]/10 rounded-full flex items-center justify-center mx-auto">
                  <Play className="w-8 h-8 text-[#635bff]" />
                </div>
                <h3 className="text-lg font-medium text-[#3a4043]">Ready to Practice?</h3>
                <p className="text-[#6f7a80] max-w-md mx-auto">
                  Start with our AI-powered mock interview. We'll guide you through common questions 
                  and provide feedback tailored to your communication style.
                </p>
                <Button 
                  size="lg" 
                  className="bg-[#635bff] hover:bg-[#524aff] text-white"
                  onClick={() => setCurrentPage('mock-interview')}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Mock Interview
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}






