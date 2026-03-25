"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Textarea } from '@/app/components/textarea';
import { Input } from '@/app/components/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/app/components/accordion';
import { Volume2, Clock, MessageSquare, Brain, CheckCircle, Lightbulb, Shield, Users, Heart, Send, HelpCircle } from 'lucide-react';

export function WorkplaceSupportTab() {
  const [activeTab, setActiveTab] = useState('coping');
  const [coachQuestion, setCoachQuestion] = useState('');
  const [showCoachResponse, setShowCoachResponse] = useState(false);

  const copingStrategies = [
    {
      challenge: 'Sensory Overload',
      strategies: [
        'Use noise-canceling headphones or earplugs',
        'Take breaks in quiet spaces every 1-2 hours',
        'Use fidget tools to help focus',
        'Request a quieter workspace or desk location',
        'Use visual barriers like plants or desk screens'
      ],
      tools: ['Noise-canceling headphones', 'Fidget toys', 'Desk plants', 'Blue light glasses']
    },
    {
      challenge: 'Anxiety & Transitions',
      strategies: [
        'Create a morning routine to start the day calmly',
        'Use transition time between tasks (5-10 minutes)',
        'Practice deep breathing or grounding techniques',
        'Have a "safe space" at work for breaks',
        'Use visual schedules or timers for predictability'
      ],
      tools: ['Breathing apps', 'Visual timers', 'Transition objects', 'Comfort items']
    },
    {
      challenge: 'Focus & Attention',
      strategies: [
        'Use the Pomodoro technique (25 min work, 5 min break)',
        'Block calendar time for deep work',
        'Turn off notifications during focus time',
        'Use background music or white noise',
        'Break large tasks into smaller, manageable steps'
      ],
      tools: ['Focus apps', 'White noise machines', 'Timer apps', 'Task management tools']
    },
    {
      challenge: 'Social Interactions',
      strategies: [
        'Prepare conversation starters for meetings',
        'Use written communication when possible',
        'Take notes during conversations to stay engaged',
        'Practice active listening techniques',
        'Set boundaries for social energy'
      ],
      tools: ['Conversation cards', 'Note-taking apps', 'Social scripts', 'Energy tracking']
    }
  ];

  const communicationTips = [
    {
      category: 'Meetings & Presentations',
      strategies: [
        'Request agendas and materials in advance',
        'Prepare talking points and questions beforehand',
        'Use written follow-ups to confirm understanding',
        'Ask for meeting minutes or recordings when available',
        'Request breaks during long meetings'
      ],
      scripts: [
        '"Could you please send me the agenda and any materials before our meeting so I can prepare?"',
        '"I\'d like to follow up on our discussion. Here\'s what I understood..."',
        '"Would it be possible to take a 5-minute break halfway through this 2-hour meeting?"'
      ]
    },
    {
      category: 'Email & Written Communication',
      strategies: [
        'Use clear subject lines and structured formatting',
        'Include action items and deadlines explicitly',
        'Confirm understanding of complex instructions',
        'Use templates for common communications',
        'Ask for clarification when needed'
      ],
      scripts: [
        '"To confirm my understanding: [restate the task] is due by [date]. Is this correct?"',
        '"Could you please clarify [specific point]? I want to make sure I complete this correctly."',
        '"Here\'s my plan for [task]. Please let me know if this approach works for you."'
      ]
    },
    {
      category: 'Team Collaboration',
      strategies: [
        'Communicate your work style preferences clearly',
        'Use project management tools for transparency',
        'Schedule regular check-ins with your manager',
        'Be open about when you need clarification',
        'Share your preferred communication methods'
      ],
      scripts: [
        '"I work best when I can focus on one task at a time. Could we discuss how to structure my workload?"',
        '"I prefer written instructions for complex tasks. Would you mind sending me an email with the details?"',
        '"I\'d like to schedule a weekly check-in to discuss my progress and any questions I have."'
      ]
    }
  ];

  const workplaceAccommodations = [
    {
      accommodation: 'Flexible Work Schedule',
      description: 'Adjust work hours to match your peak productivity times',
      example: 'Working 7 AM - 3 PM instead of 9 AM - 5 PM for morning peak focus',
      requestScript: '"I\'m most productive in the morning. Would it be possible to start earlier and finish earlier?"'
    },
    {
      accommodation: 'Written Instructions',
      description: 'Receive important information in writing rather than verbally only',
      example: 'Follow-up emails after verbal meetings with action items and deadlines',
      requestScript: '"I process information better when it\'s written down. Could you send me a summary of our discussion?"'
    },
    {
      accommodation: 'Quiet Workspace',
      description: 'Access to a low-stimulation work environment',
      example: 'Reserved desk in a quieter area or access to focus rooms',
      requestScript: '"I focus better in quieter environments. Is there a quieter area where I could work?"'
    },
    {
      accommodation: 'Extended Deadlines',
      description: 'Additional time for complex tasks requiring deep focus',
      example: 'Extra 2-3 days for detailed analysis or comprehensive reports',
      requestScript: '"For complex projects, I need a bit more time to ensure quality. Could we discuss timeline adjustments?"'
    },
    {
      accommodation: 'Regular Check-ins',
      description: 'Scheduled one-on-one meetings to discuss progress and challenges',
      example: 'Weekly 30-minute meetings with manager for feedback and support',
      requestScript: '"I\'d benefit from regular check-ins to discuss my work and get feedback. Could we schedule weekly meetings?"'
    }
  ];

  const handleCoachQuestion = () => {
    if (coachQuestion.trim()) {
      setShowCoachResponse(true);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#3a4043]">
            <Shield className="w-5 h-5 text-[#006DAE]" />
            Workplace Support & Strategies
          </CardTitle>
          <CardDescription className="text-[#6f7a80]">
            Practical guidance for thriving in your work environment
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl border border-[#cce5f5] p-1">
          <TabsTrigger value="coping" className="text-sm data-[state=active]:bg-[#006DAE] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Coping & Focus
          </TabsTrigger>
          <TabsTrigger value="communication" className="text-sm data-[state=active]:bg-[#006DAE] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Communication
          </TabsTrigger>
          <TabsTrigger value="coach" className="text-sm data-[state=active]:bg-[#006DAE] data-[state=active]:text-white rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4" />
            Ask My Coach
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coping" className="space-y-6">
          <Card className="border border-[#cce5f5] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Heart className="w-5 h-5 text-[#006DAE]" />
                Coping & Focus Strategies
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Short, practical tips for managing sensory overload, anxiety, and transitions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {copingStrategies.map((strategy, index) => (
                  <Card key={index} className="border border-[#cce5f5] bg-gradient-to-r from-white to-[#006DAE]/5">
                    <CardHeader>
                      <CardTitle className="text-lg text-[#3a4043]">{strategy.challenge}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-medium text-[#3a4043] mb-2">Strategies:</h4>
                        <div className="space-y-2">
                          {strategy.strategies.map((solution, sIndex) => (
                            <div key={sIndex} className="flex items-start gap-2">
                              <CheckCircle className="w-4 h-4 text-[#006DAE] flex-shrink-0 mt-0.5" />
                              <span className="text-sm text-[#3a4043]">{solution}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-[#3a4043] mb-2">Helpful Tools:</h4>
                        <div className="flex flex-wrap gap-2">
                          {strategy.tools.map((tool, tIndex) => (
                            <Badge key={tIndex} variant="secondary" className="text-xs bg-[#006DAE]/10 text-[#006DAE] border-[#006DAE]/20">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                <Card className="border border-[#006DAE]/20 bg-gradient-to-r from-[#006DAE]/5 to-[#006DAE]/10">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="w-5 h-5 text-[#006DAE] flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-[#3a4043] mb-1">Pro Tip</h4>
                        <p className="text-sm text-[#6f7a80] leading-relaxed">
                          Start with one small strategy and gradually implement others. Track what works best for your productivity and well-being.
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
          <Card className="border border-[#cce5f5] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <MessageSquare className="w-5 h-5 text-[#006DAE]" />
                Communication & Collaboration Tips
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Scripts, examples, and mini-guides for workplace interactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {communicationTips.map((section, index) => (
                  <AccordionItem key={index} value={`item-${index}`}>
                    <AccordionTrigger className="text-left text-[#3a4043]">
                      {section.category}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div>
                          <h5 className="font-medium text-[#3a4043] mb-2">Strategies:</h5>
                          <div className="space-y-2">
                            {section.strategies.map((strategy, sIndex) => (
                              <div key={sIndex} className="flex items-start gap-3">
                                <CheckCircle className="w-4 h-4 text-[#006DAE] flex-shrink-0 mt-0.5" />
                                <span className="text-sm text-[#3a4043]">{strategy}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h5 className="font-medium text-[#3a4043] mb-2">Sample Scripts:</h5>
                          <div className="space-y-2">
                            {section.scripts.map((script, scriptIndex) => (
                              <div key={scriptIndex} className="bg-white border border-[#e8e6f0] rounded p-3">
                                <p className="text-sm text-[#3a4043] italic">"{script}"</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <Card className="border border-[#cce5f5] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Users className="w-5 h-5 text-[#006DAE]" />
                Workplace Accommodations
              </CardTitle>
              <CardDescription className="text-[#6f7a80]">
                Common accommodations that can enhance your work performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-[#006DAE]/5 to-[#006DAE]/10 border border-[#006DAE]/20 rounded-lg p-4">
                  <h4 className="font-medium text-[#3a4043] mb-2">Remember</h4>
                  <p className="text-sm text-[#6f7a80] leading-relaxed">
                    Accommodations are not special treatment—they're adjustments that help you perform your best work. 
                    Most accommodations are simple, low-cost, and benefit the entire team.
                  </p>
                </div>
                
                <div className="space-y-4">
                  {workplaceAccommodations.map((accommodation, index) => (
                    <Card key={index} className="border border-[#cce5f5] bg-gradient-to-r from-white to-[#006DAE]/5">
                      <CardContent className="p-4 space-y-3">
                        <h4 className="font-medium text-[#3a4043]">{accommodation.accommodation}</h4>
                        <p className="text-sm text-[#6f7a80]">{accommodation.description}</p>
                        
                        <div className="bg-white border border-[#cce5f5] rounded p-3">
                          <p className="text-xs text-[#3a4043]">
                            <strong>Example:</strong> {accommodation.example}
                          </p>
                        </div>
                        
                        <div className="bg-gradient-to-r from-[#006DAE]/5 to-[#006DAE]/10 border border-[#006DAE]/20 rounded p-3">
                          <p className="text-xs text-[#3a4043]">
                            <strong>Request Script:</strong> "{accommodation.requestScript}"
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <Card className="border border-[#006DAE]/20 bg-gradient-to-r from-[#006DAE]/5 to-[#006DAE]/10">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-[#3a4043] mb-2">Requesting Accommodations</h4>
                    <div className="space-y-2 text-sm text-[#6f7a80]">
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

        <TabsContent value="coach" className="space-y-6">
          <Card className="border border-[#cce5f5] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Users className="w-5 h-5 text-[#006DAE]" />
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
                  <Textarea
                    placeholder="Ask about accommodations, communication strategies, workplace dynamics, or any other work-related questions..."
                    value={coachQuestion}
                    onChange={(e) => setCoachQuestion(e.target.value)}
                    className="min-h-[120px] focus:ring-[#006DAE]/20 focus:border-[#006DAE]/30"
                  />
                </div>
                
                <Button 
                  onClick={handleCoachQuestion}
                  disabled={!coachQuestion.trim()}
                  className="bg-[#006DAE] hover:bg-[#00528A] text-white"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Ask My Coach
                </Button>

                                {showCoachResponse && (
                  <Card className="border border-[#006DAE]/20 bg-gradient-to-r from-[#006DAE]/5 to-[#006DAE]/10">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-[#006DAE]/10 rounded-lg">
                          <HelpCircle className="w-5 h-5 text-[#006DAE]" />
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
                          <p className="mt-3 text-sm text-[#6f7a80]">
                            Would you like to schedule a one-on-one session to discuss this further?
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-[#cce5f5] bg-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#3a4043]">
                <Clock className="w-5 h-5 text-[#006DAE]" />
                Quick Tips
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-[#3a4043]">Common Questions</h4>
                  <ul className="space-y-1 text-sm text-[#6f7a80]">
                    <li>• How do I request accommodations?</li>
                    <li>• What if my manager doesn't understand?</li>
                    <li>• How do I handle workplace social dynamics?</li>
                    <li>• What if I'm overwhelmed at work?</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-[#3a4043]">Quick Actions</h4>
                  <ul className="space-y-1 text-sm text-[#6f7a80]">
                    <li>• Schedule a coaching session</li>
                    <li>• Download accommodation templates</li>
                    <li>• Access communication scripts</li>
                    <li>• Join our support community</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}






