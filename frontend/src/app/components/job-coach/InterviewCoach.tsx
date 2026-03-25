"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Progress } from '@/app/components/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { Video, Mic, Play, Pause, RotateCcw, CheckCircle, AlertCircle, Clock, Users } from 'lucide-react';

interface InterviewCoachProps {
  setCurrentPage: (page: string) => void;
}

export function InterviewCoach({ setCurrentPage }: InterviewCoachProps) {
  const [selectedPracticeType, setSelectedPracticeType] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState('practice');

  const practiceTypes = [
    {
      id: 'behavioral',
      title: 'Behavioral Questions',
      description: 'Common behavioral interview questions with neurodivergent-friendly framing',
      duration: '15-20 minutes',
      difficulty: 'Beginner'
    },
    {
      id: 'technical',
      title: 'Technical Interview',
      description: 'Problem-solving and technical questions for your field',
      duration: '30-45 minutes',
      difficulty: 'Intermediate'
    },
    {
      id: 'accommodation',
      title: 'Discussing Accommodations',
      description: 'Practice requesting workplace accommodations confidently',
      duration: '10-15 minutes',
      difficulty: 'Advanced'
    }
  ];

  const behavioralQuestions = [
    "Tell me about yourself and what brings you to this role.",
    "Describe a challenging project you worked on. How did you approach it?",
    "How do you handle feedback and adapt to changes in requirements?",
    "Give me an example of when you had to work as part of a team.",
    "What work environment helps you perform at your best?"
  ];

  const interviewTips = [
    {
      category: 'Before the Interview',
      tips: [
        'Research the company culture and values',
        'Prepare examples that showcase your systematic thinking',
        'Practice in a similar environment to reduce anxiety',
        'Prepare questions about team communication styles'
      ]
    },
    {
      category: 'During the Interview',
      tips: [
        'Take a moment to think before answering',
        'Use the STAR method (Situation, Task, Action, Result)',
        'Be authentic about your work preferences',
        'Ask for clarification if questions are unclear'
      ]
    },
    {
      category: 'Discussing Strengths',
      tips: [
        'Highlight attention to detail and accuracy',
        'Mention ability to focus deeply on complex problems',
        'Discuss systematic approach to problem-solving',
        'Share examples of innovative thinking'
      ]
    }
  ];

  const mockFeedback = [
    {
      type: 'positive',
      category: 'Communication',
      feedback: 'Clear and structured responses with good examples',
      score: 85
    },
    {
      type: 'improvement',
      category: 'Eye Contact',
      feedback: 'Consider occasional eye contact to show engagement',
      score: 70
    },
    {
      type: 'positive',
      category: 'Technical Knowledge',
      feedback: 'Demonstrated strong problem-solving approach',
      score: 90
    },
    {
      type: 'improvement',
      category: 'Pacing',
      feedback: 'Take more pauses between thoughts for clarity',
      score: 75
    }
  ];

  const handleStartPractice = (type: string) => {
    setSelectedPracticeType(type);
    setCurrentQuestion(0);
    setShowFeedback(false);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < behavioralQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setShowFeedback(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            Interview Preparation & Practice
          </CardTitle>
          <CardDescription>
            Build confidence with mock interviews designed for neurodivergent professionals
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="practice">Mock Practice</TabsTrigger>
          <TabsTrigger value="tips">Interview Tips</TabsTrigger>
          <TabsTrigger value="accommodations">Accommodations</TabsTrigger>
          <TabsTrigger value="full-mock">Full Mock Interview</TabsTrigger>
        </TabsList>

        <TabsContent value="practice" className="space-y-6">
          {!selectedPracticeType ? (
            <div className="grid md:grid-cols-3 gap-6">
              {practiceTypes.map((type) => (
                <Card 
                  key={type.id} 
                  className="border border-border bg-card hover:shadow-gentle transition-all duration-200 cursor-pointer"
                  onClick={() => handleStartPractice(type.id)}
                >
                  <CardHeader>
                    <CardTitle className="text-lg">{type.title}</CardTitle>
                    <CardDescription>{type.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{type.duration}</span>
                      </div>
                      <Badge variant={type.difficulty === 'Beginner' ? 'secondary' : type.difficulty === 'Intermediate' ? 'default' : 'destructive'}>
                        {type.difficulty}
                      </Badge>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        <Play className="w-4 h-4 mr-2" />
                        Start Practice
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : !showFeedback ? (
            <Card className="border border-border bg-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Practice Session in Progress</CardTitle>
                    <CardDescription>Take your time and answer naturally</CardDescription>
                  </div>
                  <Badge variant="outline">
                    Question {currentQuestion + 1} of {behavioralQuestions.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <Progress value={((currentQuestion + 1) / behavioralQuestions.length) * 100} />
                
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <h3 className="text-lg font-medium text-foreground mb-4">
                    {behavioralQuestions[currentQuestion]}
                  </h3>
                  
                  <div className="flex items-center gap-4">
                    <Button
                      variant={isRecording ? "destructive" : "default"}
                      onClick={() => setIsRecording(!isRecording)}
                      className="flex-shrink-0"
                    >
                      {isRecording ? (
                        <>
                          <Pause className="w-4 h-4 mr-2" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 mr-2" />
                          Start Recording
                        </>
                      )}
                    </Button>
                    
                    {isRecording && (
                      <div className="flex items-center gap-2 text-red-600">
                        <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                        <span className="text-sm">Recording...</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedPracticeType('')}>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Back to Menu
                  </Button>
                  <Button onClick={handleNextQuestion} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Next Question
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  Practice Session Complete
                </CardTitle>
                <CardDescription>Here's your personalized feedback</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  {mockFeedback.map((item, index) => (
                    <div key={index} className="border border-border rounded-lg p-4 bg-muted/30">
                      <div className="flex items-start gap-3">
                        {item.type === 'positive' ? (
                          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-foreground">{item.category}</h4>
                            <Badge variant="outline" className="text-xs">
                              {item.score}%
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{item.feedback}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setSelectedPracticeType('')}>
                    Try Another Session
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Save & Export Feedback
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tips" className="space-y-6">
          <div className="grid gap-6">
            {interviewTips.map((section, index) => (
              <Card key={index} className="border border-border bg-card">
                <CardHeader>
                  <CardTitle>{section.category}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.tips.map((tip, tipIndex) => (
                      <div key={tipIndex} className="flex items-start gap-3">
                        <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{tip}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="accommodations" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle>Discussing Workplace Accommodations</CardTitle>
              <CardDescription>
                Learn how to confidently discuss your accommodation needs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <h4 className="font-medium text-foreground mb-2">Key Principles</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Focus on how accommodations help you perform your best work</li>
                  <li>• Frame accommodations as productivity enhancers, not limitations</li>
                  <li>• Be specific about what you need and why it helps</li>
                  <li>• Show how your accommodations benefit the team</li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h4 className="font-medium text-foreground">Common Accommodation Requests:</h4>
                {[
                  {
                    accommodation: "Quiet workspace or noise-canceling headphones",
                    explanation: "Helps me maintain focus and produce higher quality work"
                  },
                  {
                    accommodation: "Written instructions and meeting agendas in advance",
                    explanation: "Allows me to prepare thoroughly and contribute more effectively"
                  },
                  {
                    accommodation: "Flexible work schedule or remote work options",
                    explanation: "Enables me to work during my most productive hours"
                  },
                  {
                    accommodation: "Clear project timelines and expectations",
                    explanation: "Helps me organize my work and deliver consistent results"
                  }
                ].map((item, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 bg-muted/30">
                    <h5 className="font-medium text-foreground mb-1">{item.accommodation}</h5>
                    <p className="text-sm text-muted-foreground italic">"{item.explanation}"</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="full-mock" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Full Mock Interview Experience
              </CardTitle>
              <CardDescription>
                Complete interview simulation with our existing mock interview system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Video className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-medium text-foreground">Ready for a Complete Mock Interview?</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Experience our full mock interview system with real-time feedback, recording capabilities, and comprehensive performance analysis.
                </p>
                <Button 
                  onClick={() => setCurrentPage('mock-interview')}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Full Mock Interview
                </Button>
              </div>
              
              <div className="border-t border-border pt-6">
                <h4 className="font-medium text-foreground mb-3">What's Included:</h4>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    "AI-powered question generation",
                    "Real-time performance feedback",
                    "Video recording and playback",
                    "Detailed performance analytics",
                    "Industry-specific questions",
                    "Accommodation-aware evaluation"
                  ].map((feature, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}   