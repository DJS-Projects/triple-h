"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Badge } from '@/app/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/tabs';
import { BookOpen, Video, FileText, ExternalLink, Clock, Star, Filter, Search } from 'lucide-react';
import { Input } from '@/app/components/input';

export function LearningHub() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('articles');

  const articles = [
    {
      title: "Understanding ADHD Strengths in the Workplace",
      description: "Discover how ADHD traits like hyperfocus and creative thinking can be professional superpowers.",
      category: "ADHD",
      readTime: "8 min read",
      difficulty: "Beginner",
      rating: 4.8,
      featured: true
    },
    {
      title: "Autism and Career Success: A Comprehensive Guide",
      description: "Navigate workplace challenges and leverage autistic strengths for career advancement.",
      category: "Autism",
      readTime: "12 min read",
      difficulty: "Intermediate",
      rating: 4.9,
      featured: true
    },
    {
      title: "Remote Work Strategies for Neurodivergent Professionals",
      description: "Create an optimal remote work environment and establish productive routines.",
      category: "Work Environment",
      readTime: "6 min read",
      difficulty: "Beginner",
      rating: 4.7,
      featured: false
    },
    {
      title: "Sensory Processing in Open Offices",
      description: "Practical strategies for managing sensory challenges in modern workplaces.",
      category: "Sensory",
      readTime: "10 min read",
      difficulty: "Intermediate",
      rating: 4.6,
      featured: false
    },
    {
      title: "Executive Function Tools for Work Success",
      description: "Apps, techniques, and systems to support planning and organization at work.",
      category: "Executive Function",
      readTime: "15 min read",
      difficulty: "Advanced",
      rating: 4.8,
      featured: false
    }
  ];

  const videos = [
    {
      title: "Interview Skills for Neurodivergent Job Seekers",
      description: "A 20-minute masterclass on navigating job interviews with confidence.",
      duration: "20:15",
      category: "Interview Skills",
      rating: 4.9,
      thumbnail: "interview-skills",
      featured: true
    },
    {
      title: "Creating Your Ideal Work Environment",
      description: "Visual guide to setting up sensory-friendly workspaces.",
      duration: "12:30",
      category: "Work Environment",
      rating: 4.7,
      thumbnail: "workspace-setup",
      featured: true
    },
    {
      title: "Communicating Your Strengths to Employers",
      description: "How to frame neurodivergent traits as professional advantages.",
      duration: "15:45",
      category: "Communication",
      rating: 4.8,
      thumbnail: "communication-skills",
      featured: false
    }
  ];

  const resources = [
    {
      title: "Accommodation Request Template",
      description: "Professional template for requesting workplace accommodations.",
      type: "Document",
      category: "Accommodations",
      format: "PDF",
      featured: true
    },
    {
      title: "Daily Planning Worksheet",
      description: "Structured worksheet for planning tasks and managing energy levels.",
      type: "Worksheet",
      category: "Executive Function",
      format: "PDF",
      featured: true
    },
    {
      title: "Sensory Break Ideas Checklist",
      description: "Quick reference guide for workplace sensory regulation strategies.",
      type: "Checklist",
      category: "Sensory",
      format: "PDF",
      featured: false
    },
    {
      title: "Networking Scripts for Introverts",
      description: "Conversation starters and networking templates for quiet professionals.",
      type: "Guide",
      category: "Networking",
      format: "PDF",
      featured: false
    }
  ];

  const categories = ['all', 'ADHD', 'Autism', 'Work Environment', 'Sensory', 'Executive Function', 'Communication', 'Interview Skills'];

  const filterContent = (items: any[], type: string) => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  return (
    <Card className="bg-white rounded-2xl border border-[#e8e6f0] shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          Learning Hub
        </CardTitle>
        <CardDescription>
          Curated resources, articles, and guides for neurodivergent professionals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 focus-gentle"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Filter className="w-4 h-4" />
                Filter
              </Button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Badge
                key={category}
                variant={selectedCategory === category ? "default" : "outline"}
                className="cursor-pointer hover:bg-accent transition-colors"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Categories' : category}
              </Badge>
            ))}
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-white rounded-xl border border-[#e8e6f0] p-1">
              <TabsTrigger value="articles" className="data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg">Articles</TabsTrigger>
              <TabsTrigger value="videos" className="data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg">Videos</TabsTrigger>
              <TabsTrigger value="resources" className="data-[state=active]:bg-[#635bff] data-[state=active]:text-white rounded-lg">Resources</TabsTrigger>
            </TabsList>

            <TabsContent value="articles" className="space-y-4">
              {/* Featured Articles */}
              {filterContent(articles.filter(a => a.featured), 'articles').length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium text-foreground">Featured Articles</h4>
                  <div className="grid gap-4">
                    {filterContent(articles.filter(a => a.featured), 'articles').map((article, index) => (
                      <Card key={index} className="bg-white rounded-xl border border-[#e8e6f0] shadow-sm hover:shadow-md transition-all duration-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <h5 className="font-medium text-foreground">{article.title}</h5>
                                <Badge variant="secondary" className="text-xs">Featured</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{article.description}</p>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {article.readTime}
                                </div>
                                <Badge variant="outline" className="text-xs">{article.category}</Badge>
                                <div className="flex items-center gap-1">
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                  {article.rating}
                                </div>
                              </div>
                            </div>
                            <Button size="sm" variant="outline">
                              <ExternalLink className="w-4 h-4 mr-2" />
                              Read
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* All Articles */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">All Articles</h4>
                <div className="grid gap-3">
                  {filterContent(articles.filter(a => !a.featured), 'articles').map((article, index) => (
                    <Card key={index} className="bg-white rounded-xl border border-[#e8e6f0] shadow-sm hover:shadow-md transition-all duration-200">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="space-y-1 flex-1">
                            <h5 className="font-medium text-foreground text-sm">{article.title}</h5>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {article.readTime}
                              </div>
                              <Badge variant="outline" className="text-xs">{article.category}</Badge>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {article.rating}
                              </div>
                            </div>
                          </div>
                          <Button size="sm" variant="outline">
                            Read
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="videos" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {filterContent(videos, 'videos').map((video, index) => (
                  <Card key={index} className="bg-white rounded-xl border border-[#e8e6f0] shadow-sm hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="aspect-video bg-primary/10 rounded-lg flex items-center justify-center">
                          <Video className="w-8 h-8 text-primary" />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h5 className="font-medium text-foreground text-sm">{video.title}</h5>
                            {video.featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{video.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{video.duration}</span>
                              <Badge variant="outline" className="text-xs">{video.category}</Badge>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                {video.rating}
                              </div>
                            </div>
                            <Button size="sm" variant="outline">
                              <Video className="w-4 h-4 mr-2" />
                              Watch
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="resources" className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {filterContent(resources, 'resources').map((resource, index) => (
                  <Card key={index} className="bg-white rounded-xl border border-[#e8e6f0] shadow-sm hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium text-foreground">{resource.title}</h5>
                              {resource.featured && <Badge variant="secondary" className="text-xs">Featured</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">{resource.description}</p>
                          </div>
                          <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline" className="text-xs">{resource.type}</Badge>
                            <Badge variant="outline" className="text-xs">{resource.category}</Badge>
                            <span>{resource.format}</span>
                          </div>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}       