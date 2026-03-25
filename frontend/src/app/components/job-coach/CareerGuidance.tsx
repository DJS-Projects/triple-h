"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Progress } from '@/app/components/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { Brain, Target, Lightbulb, TrendingUp, CheckCircle, ArrowRight } from 'lucide-react';

export function CareerGuidance() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeTab, setActiveTab] = useState('quiz');

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
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Career Guidance for Neurodivergent Professionals
          </CardTitle>
          <CardDescription>
            Discover your unique strengths and find career paths that align with your neurotype
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="quiz">Strengths Assessment</TabsTrigger>
          <TabsTrigger value="paths">Career Exploration</TabsTrigger>
          <TabsTrigger value="ai-chat">AI Career Advisor</TabsTrigger>
        </TabsList>

        <TabsContent value="quiz" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                Discover Your Professional Strengths
              </CardTitle>
              <CardDescription>
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
                    <h3 className="text-lg font-medium text-foreground">
                      {strengthsQuiz[currentQuestion].question}
                    </h3>
                    
                    <div className="grid gap-3">
                      {strengthsQuiz[currentQuestion].options.map((option, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="p-4 h-auto text-left justify-start hover:bg-accent/50"
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
                    <CheckCircle className="w-12 h-12 text-primary mx-auto" />
                    <h3 className="text-xl font-medium text-foreground">Assessment Complete!</h3>
                    <p className="text-muted-foreground">Here are your personalized career recommendations</p>
                  </div>
                  
                  <div className="space-y-4">
                    {careerPaths.map((path, index) => (
                      <Card key={index} className="border border-border bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-medium text-foreground">{path.title}</h4>
                              <p className="text-sm text-muted-foreground">{path.description}</p>
                            </div>
                            <Badge className="bg-primary/10 text-primary">
                              {path.match}% match
                            </Badge>
                          </div>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-sm font-medium text-foreground mb-1">Key Strengths:</p>
                              <div className="flex flex-wrap gap-1">
                                {path.strengths.map((strength, i) => (
                                  <Badge key={i} variant="secondary" className="text-xs">
                                    {strength}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            
                            <p className="text-sm text-muted-foreground">
                              <span className="font-medium">Work Style:</span> {path.workStyle}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  <div className="flex gap-3 pt-4">
                    <Button onClick={resetQuiz} variant="outline">
                      Retake Assessment
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Explore These Careers
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="paths" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Neurodivergent-Friendly Career Paths
              </CardTitle>
              <CardDescription>
                Explore careers that celebrate neurodivergent strengths
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  {
                    category: "Technology",
                    careers: ["Software Engineer", "Data Scientist", "Cybersecurity Analyst", "UX Designer"],
                    description: "Logical, systematic work with clear outcomes"
                  },
                  {
                    category: "Creative Arts",
                    careers: ["Graphic Designer", "Video Editor", "Writer", "Photographer"],
                    description: "Self-expression through visual and written mediums"
                  },
                  {
                    category: "Research & Analysis",
                    careers: ["Research Scientist", "Market Analyst", "Quality Assurance", "Technical Writer"],
                    description: "Deep investigation and systematic analysis"
                  },
                  {
                    category: "Specialized Services",
                    careers: ["Librarian", "Archivist", "Translator", "Consultant"],
                    description: "Expertise-focused roles with defined processes"
                  }
                ].map((category, index) => (
                  <Card key={index} className="border border-border bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg">{category.category}</CardTitle>
                      <CardDescription>{category.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {category.careers.map((career, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-primary" />
                            <span className="text-sm text-foreground">{career}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai-chat" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-primary" />
                AI Career Advisor
              </CardTitle>
              <CardDescription>
                Get personalized career advice from our neurodivergent-aware AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Brain className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground">AI Career Chat Coming Soon</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Chat with our AI advisor about career questions, skill development, and finding the right opportunities for your unique strengths.
                </p>
                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Join Waitlist
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}