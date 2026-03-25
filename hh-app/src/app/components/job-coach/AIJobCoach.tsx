"use client"

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Textarea } from '@/app/components/textarea';
import { Badge } from '@/app/components/badge';
import { ScrollArea } from '@/app/components/scroll-area';
import { Bot, User, Send, X, Calendar, Lightbulb, Heart, MessageSquare, RefreshCw } from 'lucide-react';

interface AIJobCoachChatProps {
  onClose: () => void;
  onScheduleSession: () => void;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export function AIJobCoachChat({ onClose, onScheduleSession }: AIJobCoachChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'ai',
      content: "Hi! I'm your AI Job Coach, here to help with career questions, job search strategies, and workplace challenges. I understand the unique strengths and needs of neurodivergent professionals. What would you like to discuss today?",
      timestamp: new Date(),
      suggestions: [
        "Help me improve my resume",
        "I'm struggling with interview anxiety",
        "How do I request accommodations?",
        "What careers match my strengths?"
      ]
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const aiResponses = {
    resume: {
      content: "I'd be happy to help with your resume! Here are some neurodivergent-friendly resume tips:\n\n• Use clear, structured formatting with consistent headings\n• Highlight your systematic thinking and attention to detail\n• Include specific achievements with numbers when possible\n• Consider adding a 'Core Strengths' section\n• Use action verbs that showcase your unique perspective\n\nWould you like me to review a specific section of your resume, or would you prefer to work with a human coach for more detailed feedback?",
      suggestions: ["Review my work experience section", "Help with my skills section", "Schedule a session with a human coach"]
    },
    interview: {
      content: "Interview anxiety is completely understandable! Here are some strategies that work well for neurodivergent professionals:\n\n• Practice responses to common questions beforehand\n• Request interview accommodations if needed (written questions, extra time)\n• Use the STAR method for behavioral questions\n• Prepare questions about company culture and communication styles\n• Practice in a similar environment to reduce surprises\n\nRemember, the right employer will appreciate your authentic self and unique strengths. Would you like to practice some interview questions, or explore accommodation requests?",
      suggestions: ["Practice behavioral questions", "Learn about accommodations", "Schedule mock interview with human coach"]
    },
    accommodations: {
      content: "Requesting accommodations is your right and can significantly improve your work performance! Here's how to approach it:\n\n• Focus on how accommodations help you be more productive\n• Be specific about what you need and why it helps\n• Frame it as enhancing your contributions to the team\n• Know your rights under the ADA\n• Document requests in writing\n\nCommon accommodations include:\n- Quiet workspace or noise-canceling headphones\n- Flexible work schedule\n- Written instructions and meeting agendas\n- Regular check-ins with your supervisor\n\nWould you like help drafting an accommodation request, or learn more about specific types of accommodations?",
      suggestions: ["Draft an accommodation request", "Learn about specific accommodations", "Talk to a human coach about my situation"]
    },
    careers: {
      content: "Great question! Neurodivergent individuals often excel in careers that leverage their unique strengths:\n\n🧠 **ADHD Strengths**: Creative problem-solving, hyperfocus, innovative thinking\n- Software development, marketing, entrepreneurship, crisis management\n\n🔍 **Autistic Strengths**: Attention to detail, systematic thinking, deep expertise\n- Data analysis, research, quality assurance, specialized consulting\n\n⚡ **General ND Strengths**: Pattern recognition, persistence, unique perspectives\n- UX design, technical writing, cybersecurity, project coordination\n\nTo find the best match, consider taking our career assessment or discussing your specific interests and work style preferences. Would you like to explore any of these areas further?",
      suggestions: ["Take career assessment", "Explore tech careers", "Discuss my specific interests", "Schedule career counseling session"]
    },
    default: {
      content: "I understand you're looking for guidance on this topic. While I can provide general advice and resources, some situations benefit from personalized human insight.\n\nBased on what you've shared, here are some immediate resources that might help:\n• Our Learning Hub has articles on similar topics\n• The Workplace Support section covers accommodation strategies\n• Our Resume Helper provides AI-powered feedback\n\nFor more personalized guidance, I'd recommend scheduling a session with one of our human job coaches who can provide tailored advice for your specific situation.",
      suggestions: ["Browse Learning Hub", "Check Workplace Support tips", "Schedule session with human coach"]
    }
  };

  const getAIResponse = (userMessage: string): { content: string; suggestions: string[] } => {
    const message = userMessage.toLowerCase();
    
    if (message.includes('resume') || message.includes('cv')) {
      return aiResponses.resume;
    } else if (message.includes('interview') || message.includes('anxiety') || message.includes('nervous')) {
      return aiResponses.interview;
    } else if (message.includes('accommodation') || message.includes('workplace') || message.includes('support')) {
      return aiResponses.accommodations;
    } else if (message.includes('career') || message.includes('job') || message.includes('strength')) {
      return aiResponses.careers;
    } else {
      return aiResponses.default;
    }
  };

  const handleSendMessage = async () => {
    if (!currentMessage.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: currentMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setIsTyping(true);

    // Simulate AI thinking time
    setTimeout(() => {
      const aiResponse = getAIResponse(currentMessage);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: aiResponse.content,
        timestamp: new Date(),
        suggestions: aiResponse.suggestions
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (suggestion.toLowerCase().includes('schedule') || suggestion.toLowerCase().includes('human coach')) {
      onScheduleSession();
      return;
    }
    setCurrentMessage(suggestion);
    textareaRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl h-[600px] bg-white rounded-2xl border border-[#e8e6f0] shadow-xl flex flex-col">
        <CardHeader className="flex-shrink-0 border-b border-[#e8e6f0]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#635bff]/10 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-[#635bff]" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                  AI Job Coach
                  <Badge variant="secondary" className="text-xs">Online</Badge>
                </CardTitle>
                <CardDescription>
                  Neurodivergent-aware career guidance
                </CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.type === 'ai' && (
                    <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] space-y-2 ${message.type === 'user' ? 'order-first' : ''}`}>
                    <div className={`p-3 rounded-lg ${
                      message.type === 'user' 
                        ? 'bg-[#635bff] text-white ml-auto' 
                        : 'bg-gray-100 text-[#3a4043]'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {message.suggestions && (
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <Button
                            key={index}
                            variant="outline"
                            size="sm"
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="text-xs h-auto py-1 px-2 hover:bg-accent/50"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                  {message.type === 'user' && (
                    <div className="w-6 h-6 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                      <User className="w-3 h-3 text-secondary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              
              {isTyping && (
                <div className="flex gap-3">
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="border-t border-[#e8e6f0] p-4 space-y-3">
            <div className="flex gap-2">
              <Textarea
                ref={textareaRef}
                placeholder="Ask me about careers, interviews, accommodations, or any job-related questions..."
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                className="min-h-[60px] resize-none focus-gentle"
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isTyping}
                className="bg-[#635bff] hover:bg-[#524aff] text-white self-end"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Heart className="w-3 h-3" />
                  Neurodivergent-friendly
                </span>
                <span className="flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  AI-powered guidance
                </span>
              </div>
              <Button 
                variant="link" 
                size="sm" 
                onClick={onScheduleSession}
                className="text-xs h-auto p-0 text-primary hover:text-primary/80"
              >
                <Calendar className="w-3 h-3 mr-1" />
                Need human coach?
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}