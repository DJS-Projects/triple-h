"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Progress } from '@/app/components/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { Compass, Book, Target, Lightbulb, CheckCircle, ArrowRight, Star, Play, Clock, Users } from 'lucide-react';

export function CareerGrowthTab() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState('explorer');

  const strengthsQuiz = [
    {
      question: "What type of environment helps you focus best?",
      options: [
        "Quiet, minimal distractions",
        "Some background noise or music", 
        "Collaborative, social environment",
        "Varied environments throughout the day"
      ]
    },
    {
      question: "How do you prefer to process information?",
      options: [
        "Visual diagrams and charts",
        "Step-by-step written instructions",
        "Hands-on experimentation",
        "Verbal discussions and explanations"
      ]
    },
    {
      question: "What gives you the most satisfaction at work?",
      options: [
        "Solving complex problems systematically",
        "Creating something new and innovative",
        "Helping and supporting others",
        "Organizing and improving processes"
      ]
    },
    {
      question: "How do you handle deadlines and time pressure?",
      options: [
        "I work best with clear timelines and structure",
        "I thrive under pressure and tight deadlines",
        "I prefer flexible deadlines with regular check-ins",
        "I need buffer time and advance notice"
      ]
    }
  ];

  const careerPaths = [
    {
      title: "Software Development",
      match: 92,
      description: "Systematic problem-solving with clear logic",
      strengths: ["Pattern recognition", "Attention to detail", "Deep focus"],
      workStyle: "Remote-friendly, structured projects"
    },
    {
      title: "UX/UI Design", 
      match: 87,
      description: "Visual creativity with user empathy",
      strengths: ["Visual thinking", "User perspective", "Creative solutions"],
      workStyle: "Collaborative yet independent work"
    },
    {
      title: "Data Analysis",
      match: 83,
      description: "Finding patterns in complex information",
      strengths: ["Analytical thinking", "Accuracy", "Detail orientation"],
      workStyle: "Research-focused, minimal interruptions"
    }
  ];

  const upskillResources = [
    {
      category: "Communication Skills",
      resources: [
        {
          title: "Neurodivergent Communication Styles",
          type: "Video Course",
          duration: "2 hours",
          difficulty: "Beginner",
          description: "Learn to communicate your unique strengths effectively"
        },
        {
          title: "Email Templates for Neurodivergent Professionals",
          type: "Resource Pack",
          duration: "30 min",
          difficulty: "Beginner", 
          description: "Pre-written templates for common workplace communications"
        }
      ]
    },
    {
      category: "Organization & Time Management",
      resources: [
        {
          title: "ADHD-Friendly Productivity Systems",
          type: "Interactive Course",
          duration: "3 hours",
          difficulty: "Intermediate",
          description: "Build systems that work with your brain, not against it"
        },
        {
          title: "Sensory-Friendly Workspace Design",
          type: "Guide",
          duration: "45 min",
          difficulty: "Beginner",
          description: "Create an environment that supports your focus"
        }
      ]
    },
    {
      category: "Self-Advocacy",
      resources: [
        {
          title: "Requesting Workplace Accommodations",
          type: "Video Series",
          duration: "1.5 hours",
          difficulty: "Intermediate",
          description: "Learn how to advocate for your needs professionally"
        },
        {
          title: "Disclosing Neurodivergence at Work",
          type: "Interactive Guide",
          duration: "1 hour",
          difficulty: "Advanced",
          description: "Navigate when and how to share your neurotype"
        }
      ]
    },
    {
      category: "Technical Skills",
      resources: [
        {
          title: "Coding for Neurodivergent Minds",
          type: "Video Course",
          duration: "4 hours",
          difficulty: "Beginner",
          description: "Learn programming with neurodivergent-friendly methods"
        },
        {
          title: "Data Analysis Fundamentals",
          type: "Interactive Course",
          duration: "6 hours",
          difficulty: "Intermediate",
          description: "Structured approach to data analysis and visualization"
        }
      ]
    }
  ];

  const handleAnswer = (answer: string) => {
    const newAnswers = [...quizAnswers, answer];
    setQuizAnswers(newAnswers);
    
    if (currentQuestion < strengthsQuiz.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowResults(true);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setQuizAnswers([]);
    setShowResults(false);
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Compass className="w-5 h-5 text-[#635bff]" />
            Career Growth & Discovery
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Discover your strengths, explore career paths, and develop new skills
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white rounded-xl border border-[#e8e6f0] p-1">
          <TabsTrigger value="explorer" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Compass className="w-4 h-4" />
            Career Path Explorer
          </TabsTrigger>
          <TabsTrigger value="upskill" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Book className="w-4 h-4" />
            Upskill Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="explorer" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Target className="w-5 h-5 text-[#635bff]" />
                Discover Your Professional Strengths
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                A gentle assessment designed specifically for neurodivergent professionals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!showResults ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-sm">
                      Question {currentQuestion + 1} of {strengthsQuiz.length}
                    </Badge>
                    <Progress 
                      value={((currentQuestion + 1) / strengthsQuiz.length) * 100} 
                      className="w-32"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-[#3a4043]">
                      {strengthsQuiz[currentQuestion].question}
                    </h3>
                    
                    <div className="grid gap-3">
                      {strengthsQuiz[currentQuestion].options.map((option, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="p-4 h-auto text-left justify-start hover:bg-[#635bff]/10 border-[#e8e6f0] hover:border-[#635bff]/30"
                          onClick={() => handleAnswer(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <CheckCircle className="w-12 h-12 text-[#635bff] mx-auto" />
                    <h3 className="text-xl font-medium text-[#3a4043]">Assessment Complete!</h3>
                    <p className="text-[#6f7a80]">Here are your personalized career recommendations</p>
                  </div>
                  
                  <div className="space-y-4">
                    {careerPaths.map((path, index) => (
                      <Card key={index} className="border border-[#e8e6f0] bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-[#3a4043]">{path.title}</h4>
                              <p className="text-sm text-[#6f7a80]">{path.description}</p>
                            </div>
                            <Badge className="bg-[#635bff]/10 text-[#635bff] border-[#635bff]/20">
                              {path.match}% match
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-[#3a4043] mb-1">Key Strengths:</p>
                              <div className="flex flex-wrap gap-1">
                                {path.strengths.map((strength, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs bg-white/50">
                                    {strength}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <p className="text-sm text-[#6f7a80]">
                              <span className="font-medium">Work Style:</span> {path.workStyle}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button onClick={resetQuiz} variant="outline" className="border-[#e8e6f0]">
                      Retake Assessment
                    </Button>
                    <Button className="bg-[#635bff] hover:bg-[#524aff] text-white">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Explore These Careers
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upskill" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Book className="w-5 h-5 text-[#635bff]" />
                Neurodivergent-Friendly Learning Resources
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Curated learning materials designed for different learning styles and sensory needs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {upskillResources.map((category, categoryIndex) => (
                  <div key={categoryIndex} className="space-y-4">
                    <h3 className="text-lg font-semibold text-[#3a4043] flex items-center gap-2">
                      <Star className="w-5 h-5 text-[#635bff]" />
                      {category.category}
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-4">
                      {category.resources.map((resource, resourceIndex) => (
                        <Card key={resourceIndex} className="border border-[#e8e6f0] bg-gradient-to-br from-white to-[#635bff]/5 hover:shadow-lg transition-all duration-300">
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-start justify-between">
                              <h4 className="font-medium text-[#3a4043]">{resource.title}</h4>
                              <Badge variant="outline" className="text-xs bg-[#635bff]/10 text-[#635bff] border-[#635bff]/20">
                                {resource.type}
                              </Badge>
                            </div>
                            
                            <p className="text-sm text-[#6f7a80] leading-relaxed">{resource.description}</p>
                            
                            <div className="flex items-center gap-4 text-xs text-[#6f7a80]">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {resource.duration}
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {resource.difficulty}
                              </div>
                            </div>
                            
                            <Button size="sm" className="w-full bg-[#635bff] hover:bg-[#524aff] text-white">
                              <Play className="w-3 h-3 mr-2" />
                              Start Learning
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
                
                <Card className="border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-[#635bff] flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-[#3a4043] mb-1">Learning Tips</h4>
                        <p className="text-sm text-[#6f7a80] leading-relaxed">
                          Take breaks every 25-30 minutes, use fidget tools if helpful, and don't hesitate to replay sections. 
                          Learning at your own pace is perfectly fine!
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


