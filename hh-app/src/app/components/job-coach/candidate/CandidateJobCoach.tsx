"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { 
  Brain, 
  Compass, 
  Book, 
  Target, 
  Lightbulb, 
  Shield, 
  Clock, 
  MessageSquare,
  Users,
  Heart,
  Star,
  CheckCircle,
  ArrowRight,
  Play,
  Download,
  FileText,
  Eye,
  Sparkles
} from 'lucide-react';

export function CandidateJobCoach() {
  const [activeTab, setActiveTab] = useState('career-growth');

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Brain className="w-5 h-5 text-[#635bff]" />
            Your Personal Job Coach
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Discover your strengths, build skills, and find career success
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl border border-[#e8e6f0] p-1">
          <TabsTrigger value="career-growth" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Compass className="w-4 h-4" />
            Career Growth
          </TabsTrigger>
          <TabsTrigger value="application-support" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Application Support
          </TabsTrigger>
          <TabsTrigger value="workplace-support" className="text-sm data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4" />
            Workplace Support
          </TabsTrigger>
        </TabsList>

        <TabsContent value="career-growth" className="space-y-6">
          <CareerGrowthTab />
        </TabsContent>

        <TabsContent value="application-support" className="space-y-6">
          <ApplicationSupportTab />
        </TabsContent>

        <TabsContent value="workplace-support" className="space-y-6">
          <WorkplaceSupportTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CareerGrowthTab() {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('explorer');

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
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
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
          <Card className="border border-[#e8e6f0] bg-card">
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
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#635bff] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentQuestion + 1) / strengthsQuiz.length) * 100}%` }}
                      />
                    </div>
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
          <Card className="border border-[#e8e6f0] bg-card">
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

function ApplicationSupportTab() {
  const [resumeText, setResumeText] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const aiSuggestions = [
    {
      type: 'strength',
      icon: <CheckCircle className="w-4 h-4 text-green-600" />,
      title: 'Strong Action Verbs',
      content: 'Great use of "implemented," "optimized," and "collaborated"'
    },
    {
      type: 'improvement',
      icon: <Lightbulb className="w-4 h-4 text-amber-600" />,
      title: 'Quantify Achievements',
      content: 'Add specific numbers: "Reduced processing time by 30%" instead of "Improved efficiency"'
    }
  ];

  const handleAnalyzeResume = () => {
    if (resumeText.trim()) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="space-y-6">
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
            <textarea
              placeholder="Paste your resume content here..."
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              className="w-full min-h-[300px] p-3 border border-[#e8e6f0] rounded-lg focus:ring-[#635bff]/20 focus:border-[#635bff]/30"
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

      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Play className="w-5 h-5 text-[#635bff]" />
            Mock Interview Practice
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Practice interviews in a safe, supportive environment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-[#635bff]/10 rounded-full flex items-center justify-center mx-auto">
              <Play className="w-8 h-8 text-[#635bff]" />
            </div>
            <h3 className="text-lg font-medium text-[#3a4043]">Ready to Practice?</h3>
            <p className="text-[#6f7a80] max-w-md mx-auto">
              Start with our AI-powered mock interview. We'll guide you through common questions 
              and provide feedback tailored to your communication style.
            </p>
            <Button size="lg" className="bg-[#635bff] hover:bg-[#524aff] text-white">
              <Play className="w-4 h-4 mr-2" />
              Start Mock Interview
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WorkplaceSupportTab() {
  const [coachQuestion, setCoachQuestion] = useState('');
  const [showCoachResponse, setShowCoachResponse] = useState(false);

  const copingStrategies = [
    {
      challenge: 'Sensory Overload',
      strategies: [
        'Use noise-canceling headphones or earplugs',
        'Take breaks in quiet spaces every 1-2 hours',
        'Use fidget tools to help focus',
        'Request a quieter workspace or desk location'
      ]
    },
    {
      challenge: 'Anxiety & Transitions',
      strategies: [
        'Create a morning routine to start the day calmly',
        'Use transition time between tasks (5-10 minutes)',
        'Practice deep breathing or grounding techniques',
        'Have a "safe space" at work for breaks'
      ]
    }
  ];

  const handleCoachQuestion = () => {
    if (coachQuestion.trim()) {
      setShowCoachResponse(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Heart className="w-5 h-5 text-[#635bff]" />
            Coping & Focus Strategies
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Short, practical tips for managing sensory overload, anxiety, and transitions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {copingStrategies.map((strategy, index) => (
              <Card key={index} className="border border-[#e8e6f0] bg-gradient-to-r from-white to-[#635bff]/5">
                <CardHeader>
                  <CardTitle className="text-lg text-[#3a4043]">{strategy.challenge}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-[#3a4043] mb-2">Strategies:</h4>
                    <div className="space-y-2">
                      {strategy.strategies.map((solution, sIndex) => (
                        <div key={sIndex} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-[#635bff] flex-shrink-0 mt-0.5" />
                          <span className="text-sm text-[#3a4043]">{solution}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[#e8e6f0] bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Users className="w-5 h-5 text-[#635bff]" />
            Ask My Coach
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Quick Q&A chat area where you can ask questions about workplace challenges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#3a4043]">What workplace challenge can I help you with?</label>
              <textarea
                placeholder="Ask about accommodations, communication strategies, workplace dynamics, or any other work-related questions..."
                value={coachQuestion}
                onChange={(e) => setCoachQuestion(e.target.value)}
                className="w-full min-h-[120px] p-3 border border-[#e8e6f0] rounded-lg focus:ring-[#635bff]/20 focus:border-[#635bff]/30"
              />
            </div>
            
            <Button 
              onClick={handleCoachQuestion}
              disabled={!coachQuestion.trim()}
              className="bg-[#635bff] hover:bg-[#524aff] text-white"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Ask My Coach
            </Button>

            {showCoachResponse && (
              <Card className="border border-[#635bff]/20 bg-gradient-to-r from-[#635bff]/5 to-[#635bff]/10">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-[#635bff]/10 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-[#635bff]" />
                    </div>
                    <div>
                      <h4 className="font-medium text-[#3a4043] mb-2">Coach Response</h4>
                      <p className="text-sm text-[#6f7a80] leading-relaxed">
                        Thank you for your question! Based on your situation, here are some strategies that might help:
                      </p>
                      <ul className="mt-3 space-y-1 text-sm text-[#6f7a80]">
                        <li>• Consider requesting a written summary of expectations</li>
                        <li>• Practice the conversation with a trusted colleague first</li>
                        <li>• Focus on how the accommodation benefits your work quality</li>
                        <li>• Remember that advocating for your needs is professional and appropriate</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}







