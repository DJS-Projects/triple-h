"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Textarea } from '@/app/components/textarea';
import { Input } from '@/app/components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { FileText, Lightbulb, Download, Eye, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

export function ResumeHelper() {
  const [resumeText, setResumeText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [activeTab, setActiveTab] = useState('builder');

  const templates = [
    {
      id: 'clean',
      name: 'Clean & Minimal',
      description: 'Distraction-free design with clear sections',
      features: ['High contrast text', 'Spacious layout', 'Easy scanning']
    },
    {
      id: 'structured',
      name: 'Structured Professional',
      description: 'Organized sections with visual hierarchy',
      features: ['Clear headings', 'Consistent formatting', 'Professional tone']
    },
    {
      id: 'skills-focused',
      name: 'Skills-Focused',
      description: 'Highlights technical and soft skills prominently',
      features: ['Skills showcase', 'Achievement focus', 'Industry-specific']
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

  const handleAnalyzeResume = () => {
    if (resumeText.trim()) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Resume & Cover Letter Assistant
          </CardTitle>
          <CardDescription>
            AI-powered suggestions and templates designed for neurodivergent professionals
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="builder">Resume Builder</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="cover-letter">Cover Letters</TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Resume Content
                </CardTitle>
                <CardDescription>
                  Paste your resume text for AI-powered suggestions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Paste your resume content here..."
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  className="min-h-[300px] focus-gentle"
                />
                <Button 
                  onClick={handleAnalyzeResume}
                  disabled={!resumeText.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Get AI Suggestions
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-primary" />
                  AI Feedback
                </CardTitle>
                <CardDescription>
                  Personalized suggestions for improvement
                </CardDescription>
              </CardHeader>
              <CardContent>
                {showSuggestions ? (
                  <div className="space-y-4">
                    {aiSuggestions.map((suggestion, index) => (
                      <div key={index} className="border border-border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-start gap-3">
                          {suggestion.icon}
                          <div className="space-y-1">
                            <h4 className="font-medium text-sm text-foreground">{suggestion.title}</h4>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {suggestion.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="flex gap-2 pt-4">
                      <Button size="sm" variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Export Suggestions
                      </Button>
                      <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        Apply Changes
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 space-y-3">
                    <Lightbulb className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      Paste your resume content and click "Get AI Suggestions" to receive personalized feedback.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Neurodivergent-Friendly Resume Templates</CardTitle>
              <CardDescription>
                Choose a template designed for clarity and easy scanning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className={`border cursor-pointer transition-all duration-200 hover:shadow-gentle ${
                      selectedTemplate === template.id ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                    }`}
                    onClick={() => setSelectedTemplate(template.id)}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {template.features.map((feature, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            <span className="text-sm text-foreground">{feature}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex gap-2 mt-4">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Eye className="w-4 h-4 mr-2" />
                          Preview
                        </Button>
                        <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                          Use Template
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cover-letter" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Cover Letter Guide</CardTitle>
              <CardDescription>
                Write compelling cover letters that highlight your neurodivergent strengths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {coverLetterTips.map((tip, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 bg-muted/30">
                    <div className="space-y-3">
                      <h4 className="font-medium text-foreground">{tip.section} Paragraph</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{tip.tip}</p>
                      <div className="bg-background border border-border rounded p-3">
                        <p className="text-sm text-foreground italic">{tip.example}</p>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Card className="border border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-foreground mb-2">💡 Neurodivergent-Friendly Tips</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      <li>• Be authentic about your work style preferences</li>
                      <li>• Highlight systematic thinking and attention to detail</li>
                      <li>• Mention your ability to focus deeply on complex problems</li>
                      <li>• Show how you bring unique perspectives to teams</li>
                    </ul>
                  </CardContent>
                </Card>
                
                <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                  <FileText className="w-4 h-4 mr-2" />
                  Generate Cover Letter Template
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}