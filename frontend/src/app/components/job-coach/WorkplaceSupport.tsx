"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/accordion';
import { Volume2, Clock, MessageSquare, Brain, CheckCircle, Lightbulb, Shield, Users } from 'lucide-react';

export function WorkplaceSupport() {
  const [activeTab, setActiveTab] = useState('sensory');

  const sensoryStrategies = [
    {
      challenge: 'Open office noise and distractions',
      solutions: [
        'Use noise-canceling headphones or white noise apps',
        'Request a quieter workspace or desk location',
        'Use visual barriers like plants or desk screens',
        'Schedule focused work time in quiet spaces'
      ],
      tools: ['Noise-canceling headphones', 'White noise apps', 'Focus music playlists']
    },
    {
      challenge: 'Bright or harsh lighting',
      solutions: [
        'Use desk lamps with warm, adjustable lighting',
        'Wear tinted glasses to reduce glare',
        'Position your monitor away from direct light',
        'Request lighting accommodations from facilities'
      ],
      tools: ['Blue light glasses', 'Desk lamps', 'Monitor filters']
    },
    {
      challenge: 'Overwhelming visual stimuli',
      solutions: [
        'Organize your workspace to reduce clutter',
        'Use neutral colors and minimal decorations',
        'Create visual boundaries with organizers',
        'Take regular breaks in calmer environments'
      ],
      tools: ['Desk organizers', 'Neutral color schemes', 'Privacy screens']
    }
  ];

  const communicationTips = [
    {
      category: 'Meetings & Presentations',
      strategies: [
        'Request agendas and materials in advance',
        'Prepare talking points and questions beforehand',
        'Use written follow-ups to confirm understanding',
        'Ask for meeting minutes or recordings when available'
      ]
    },
    {
      category: 'Email & Written Communication',
      strategies: [
        'Use clear subject lines and structured formatting',
        'Include action items and deadlines explicitly',
        'Confirm understanding of complex instructions',
        'Use templates for common communications'
      ]
    },
    {
      category: 'Team Collaboration',
      strategies: [
        'Communicate your work style preferences clearly',
        'Use project management tools for transparency',
        'Schedule regular check-ins with your manager',
        'Be open about when you need clarification'
      ]
    }
  ];

  const timeManagementTools = [
    {
      technique: 'Time Blocking',
      description: 'Schedule specific time blocks for different types of work',
      benefits: ['Reduces decision fatigue', 'Improves focus', 'Creates routine'],
      implementation: 'Use calendar apps to block time for deep work, meetings, and breaks'
    },
    {
      technique: 'Pomodoro Technique',
      description: '25-minute focused work sessions with 5-minute breaks',
      benefits: ['Maintains concentration', 'Prevents burnout', 'Tracks productivity'],
      implementation: 'Use timer apps and adjust intervals based on your attention span'
    },
    {
      technique: 'Task Prioritization',
      description: 'Use frameworks like Eisenhower Matrix or ABC prioritization',
      benefits: ['Focuses on important work', 'Reduces overwhelm', 'Improves outcomes'],
      implementation: 'Review and prioritize tasks daily using your preferred method'
    },
    {
      technique: 'Energy Management',
      description: 'Schedule demanding tasks during your peak energy hours',
      benefits: ['Maximizes productivity', 'Reduces fatigue', 'Improves quality'],
      implementation: 'Track your energy patterns and plan accordingly'
    }
  ];

  const accommodationExamples = [
    {
      accommodation: 'Flexible Work Schedule',
      description: 'Adjust work hours to match your peak productivity times',
      example: 'Working 7 AM - 3 PM instead of 9 AM - 5 PM for morning peak focus'
    },
    {
      accommodation: 'Written Instructions',
      description: 'Receive important information in writing rather than verbally only',
      example: 'Follow-up emails after verbal meetings with action items and deadlines'
    },
    {
      accommodation: 'Quiet Workspace',
      description: 'Access to a low-stimulation work environment',
      example: 'Reserved desk in a quieter area or access to focus rooms'
    },
    {
      accommodation: 'Extended Deadlines',
      description: 'Additional time for complex tasks requiring deep focus',
      example: 'Extra 2-3 days for detailed analysis or comprehensive reports'
    },
    {
      accommodation: 'Regular Check-ins',
      description: 'Scheduled one-on-one meetings to discuss progress and challenges',
      example: 'Weekly 30-minute meetings with manager for feedback and support'
    }
  ];

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Workplace Support & Strategies
          </CardTitle>
          <CardDescription>
            Practical guidance for thriving in your work environment
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sensory">Sensory Management</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="time">Time Management</TabsTrigger>
          <TabsTrigger value="accommodations">Accommodations</TabsTrigger>
        </TabsList>

        <TabsContent value="sensory" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-primary" />
                Sensory Management Strategies
              </CardTitle>
              <CardDescription>
                Create a comfortable and productive work environment
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {sensoryStrategies.map((strategy, index) => (
                  <Card key={index} className="border border-border bg-muted/30">
                    <CardHeader>
                      <CardTitle className="text-lg">{strategy.challenge}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Solutions:</h4>
                        <div className="space-y-2">
                          {strategy.solutions.map((solution, sIndex) => (
                            <div key={sIndex} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-foreground">{solution}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-foreground mb-2">Recommended Tools:</h4>
                        <div className="flex flex-wrap gap-2">
                          {strategy.tools.map((tool, tIndex) => (
                            <Badge key={tIndex} variant="secondary" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Card className="border border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground mb-1">Pro Tip</h4>
                        <p className="text-sm text-muted-foreground">
                          Start with one small accommodation and gradually implement others. Track what works best for your productivity and well-being.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="communication" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-primary" />
                Communication Strategies
              </CardTitle>
              <CardDescription>
                Effective workplace communication for neurodivergent professionals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {communicationTips.map((section, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left">
                      {section.category}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-3 pt-2">
                        {section.strategies.map((strategy, sIndex) => (
                          <div key={sIndex} className="flex items-start gap-3">
                            <CheckCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-foreground">{strategy}</span>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              
              <div className="mt-6 space-y-4">
                <h4 className="font-medium text-foreground">Sample Communication Templates</h4>
                <div className="grid gap-4">
                  <Card className="border border-border bg-muted/30">
                    <CardContent className="p-4">
                      <h5 className="font-medium text-foreground mb-2">Requesting Clarification</h5>
                      <p className="text-sm text-muted-foreground italic">
                        "Thank you for the overview in our meeting. Could you please send me the key action items and deadlines in writing so I can ensure I understand correctly and plan accordingly?"
                      </p>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-border bg-muted/30">
                    <CardContent className="p-4">
                      <h5 className="font-medium text-foreground mb-2">Communicating Work Style</h5>
                      <p className="text-sm text-muted-foreground italic">
                        "I'm most productive when I can work on complex tasks during the morning hours with minimal interruptions. Would it be possible to schedule our regular check-ins in the afternoon?"
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Time & Energy Management
              </CardTitle>
              <CardDescription>
                Strategies to optimize your productivity and manage energy levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6">
                {timeManagementTools.map((tool, index) => (
                  <Card key={index} className="border border-border bg-muted/30">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-medium text-foreground">{tool.technique}</h4>
                        <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                      </div>
                      
                      <p className="text-sm text-muted-foreground">{tool.description}</p>
                      
                      <div>
                        <h5 className="text-sm font-medium text-foreground mb-1">Benefits:</h5>
                        <div className="flex flex-wrap gap-1">
                          {tool.benefits.map((benefit, bIndex) => (
                            <Badge key={bIndex} variant="secondary" className="text-xs">
                              {benefit}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="bg-background border border-border rounded p-3">
                        <p className="text-xs text-muted-foreground">
                          <strong>How to implement:</strong> {tool.implementation}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accommodations" className="space-y-6">
          <Card className="border border-border bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Workplace Accommodations
              </CardTitle>
              <CardDescription>
                Common accommodations that can enhance your work performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h4 className="font-medium text-foreground mb-2">Remember</h4>
                  <p className="text-sm text-muted-foreground">
                    Accommodations are not special treatment—they're adjustments that help you perform your best work. Most accommodations are simple, low-cost, and benefit the entire team.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {accommodationExamples.map((accommodation, index) => (
                    <Card key={index} className="border border-border bg-muted/30">
                      <CardContent className="p-4 space-y-2">
                        <h4 className="font-medium text-foreground">{accommodation.accommodation}</h4>
                        <p className="text-sm text-muted-foreground">{accommodation.description}</p>
                        <div className="bg-background border border-border rounded p-3">
                          <p className="text-xs text-muted-foreground">
                            <strong>Example:</strong> {accommodation.example}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <Card className="border border-primary/20 bg-primary/5">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-foreground mb-2">Requesting Accommodations</h4>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p>• Focus on how the accommodation will improve your productivity</p>
                      <p>• Be specific about what you need and why it helps</p>
                      <p>• Offer to try the accommodation on a trial basis</p>
                      <p>• Document the request and any agreements in writing</p>
                      <p>• Know your rights under the ADA (Americans with Disabilities Act)</p>
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