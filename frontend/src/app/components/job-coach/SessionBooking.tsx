"use client"

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/card';
import { Button } from '@/app/components/button';
import { Input } from '@/app/components/input';
import { Label } from '@/app/components/label';
import { Textarea } from '@/app/components/textarea';
import { Badge } from '@/app/components/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/select';
import { Calendar, Clock, User, X, CheckCircle, Star, Video, Phone, MapPin } from 'lucide-react';

interface SessionBookingProps {
  onClose: () => void;
}

export function SessionBooking({ onClose }: SessionBookingProps) {
  const [step, setStep] = useState(1);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [sessionType, setSessionType] = useState('');
  const [bookingComplete, setBookingComplete] = useState(false);

  const coaches = [
    {
      id: 'sarah',
      name: 'Dr. Sarah Martinez',
      specialties: ['ADHD', 'Career Transitions', 'Interview Skills'],
      experience: '8+ years',
      rating: 4.9,
      bio: 'Specializes in helping neurodivergent professionals navigate career challenges with evidence-based strategies.',
      availability: 'Available this week',
      sessionTypes: ['Video Call', 'Phone Call']
    },
    {
      id: 'james',
      name: 'James Chen',
      specialties: ['Autism', 'Workplace Accommodations', 'Resume Building'],
      experience: '6+ years',
      rating: 4.8,
      bio: 'Former HR professional who understands both employee and employer perspectives on neurodiversity.',
      availability: 'Available next week',
      sessionTypes: ['Video Call', 'Phone Call', 'In-Person']
    },
    {
      id: 'maya',
      name: 'Maya Patel',
      specialties: ['Executive Function', 'Time Management', 'Sensory Processing'],
      experience: '10+ years',
      rating: 4.9,
      bio: 'Occupational therapist and career coach specializing in workplace strategies for neurodivergent adults.',
      availability: 'Limited availability',
      sessionTypes: ['Video Call', 'Phone Call']
    }
  ];

  const availableDates = [
    { date: '2024-01-15', day: 'Monday', availability: 'high' },
    { date: '2024-01-16', day: 'Tuesday', availability: 'medium' },
    { date: '2024-01-17', day: 'Wednesday', availability: 'high' },
    { date: '2024-01-18', day: 'Thursday', availability: 'low' },
    { date: '2024-01-19', day: 'Friday', availability: 'medium' },
    { date: '2024-01-22', day: 'Monday', availability: 'high' },
    { date: '2024-01-23', day: 'Tuesday', availability: 'high' }
  ];

  const timeSlots = [
    '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'
  ];

  const sessionTypes = [
    {
      type: 'Career Guidance',
      duration: '60 minutes',
      description: 'Explore career paths and leverage your neurodivergent strengths'
    },
    {
      type: 'Interview Coaching',
      duration: '45 minutes',
      description: 'Practice interviews and build confidence'
    },
    {
      type: 'Resume Review',
      duration: '30 minutes',
      description: 'Get personalized feedback on your resume and cover letter'
    },
    {
      type: 'Workplace Support',
      duration: '60 minutes',
      description: 'Discuss accommodations and workplace strategies'
    }
  ];

  const handleBookSession = () => {
    // In a real app, this would send the booking data to a backend
    setBookingComplete(true);
  };

  const renderCoachSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-foreground mb-2">Choose Your Coach</h3>
        <p className="text-sm text-muted-foreground mb-4">
          All our coaches are trained in neurodiversity and understand the unique strengths and challenges you may face.
        </p>
      </div>
      
      <div className="space-y-3">
        {coaches.map((coach) => (
          <Card 
            key={coach.id}
            className={`border cursor-pointer transition-all duration-200 hover:shadow-gentle ${
              selectedCoach === coach.id ? 'border-primary bg-primary/5' : 'border-border bg-card'
            }`}
            onClick={() => setSelectedCoach(coach.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium text-foreground">{coach.name}</h4>
                      <p className="text-sm text-muted-foreground">{coach.experience} experience</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm text-foreground">{coach.rating}</span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-muted-foreground">{coach.bio}</p>
                  
                  <div className="flex flex-wrap gap-2">
                    {coach.specialties.map((specialty, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {specialty}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{coach.availability}</span>
                    <div className="flex items-center gap-2">
                      {coach.sessionTypes.includes('Video Call') && <Video className="w-3 h-3" />}
                      {coach.sessionTypes.includes('Phone Call') && <Phone className="w-3 h-3" />}
                      {coach.sessionTypes.includes('In-Person') && <MapPin className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderSessionDetails = () => (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium text-foreground mb-2">Session Details</h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred session type and schedule a time that works for you.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="session-type" className="text-sm font-medium text-foreground">Session Type</Label>
          <Select value={sessionType} onValueChange={setSessionType}>
            <SelectTrigger className="mt-1 focus-gentle">
              <SelectValue placeholder="Select session type..." />
            </SelectTrigger>
            <SelectContent>
              {sessionTypes.map((type, index) => (
                <SelectItem key={index} value={type.type}>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span>{type.type}</span>
                      <Badge variant="outline" className="text-xs">{type.duration}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium text-foreground">Preferred Date</Label>
            <div className="mt-2 space-y-2">
              {availableDates.slice(0, 4).map((dateOption) => (
                <Button
                  key={dateOption.date}
                  variant={selectedDate === dateOption.date ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedDate(dateOption.date)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  {dateOption.day}, Jan {new Date(dateOption.date).getDate()}
                  <Badge 
                    variant="outline" 
                    className={`ml-auto text-xs ${
                      dateOption.availability === 'high' ? 'text-green-600' :
                      dateOption.availability === 'medium' ? 'text-yellow-600' : 'text-red-600'
                    }`}
                  >
                    {dateOption.availability === 'high' ? 'Available' :
                     dateOption.availability === 'medium' ? 'Limited' : 'Few slots'}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground">Preferred Time</Label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {timeSlots.map((time) => (
                <Button
                  key={time}
                  variant={selectedTime === time ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTime(time)}
                  disabled={!selectedDate}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {time}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContactInfo = () => (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-foreground mb-2">Contact Information</h3>
        <p className="text-sm text-muted-foreground">
          We'll use this information to send you session details and reminders.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="first-name" className="text-sm font-medium text-foreground">First Name</Label>
          <Input id="first-name" className="mt-1 focus-gentle" placeholder="Enter your first name" />
        </div>
        <div>
          <Label htmlFor="last-name" className="text-sm font-medium text-foreground">Last Name</Label>
          <Input id="last-name" className="mt-1 focus-gentle" placeholder="Enter your last name" />
        </div>
      </div>

      <div>
        <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
        <Input id="email" type="email" className="mt-1 focus-gentle" placeholder="Enter your email address" />
      </div>

      <div>
        <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone Number</Label>
        <Input id="phone" type="tel" className="mt-1 focus-gentle" placeholder="Enter your phone number" />
      </div>

      <div>
        <Label htmlFor="goals" className="text-sm font-medium text-foreground">Session Goals (Optional)</Label>
        <Textarea 
          id="goals" 
          className="mt-1 focus-gentle" 
          placeholder="Briefly describe what you'd like to focus on during your session..."
          rows={3}
        />
      </div>
    </div>
  );

  const renderConfirmation = () => {
    const selectedCoachData = coaches.find(c => c.id === selectedCoach);
    const selectedSessionData = sessionTypes.find(s => s.type === sessionType);
    
    return (
      <div className="space-y-6">
        <div className="text-center">
          <CheckCircle className="w-12 h-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Session Booked Successfully!</h3>
          <p className="text-sm text-muted-foreground">
            We've sent a confirmation email with all the details.
          </p>
        </div>

        <Card className="border border-border bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">Session Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{selectedCoachData?.name}</p>
                <p className="text-sm text-muted-foreground">{selectedCoachData?.specialties.join(', ')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">
                  {selectedDate && new Date(selectedDate).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
                <p className="text-sm text-muted-foreground">{selectedTime}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">{sessionType}</p>
                <p className="text-sm text-muted-foreground">{selectedSessionData?.duration}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-2">What's Next?</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li>• You'll receive a calendar invite with session details</li>
            <li>• A reminder will be sent 24 hours before your session</li>
            <li>• Your coach will send any preparation materials if needed</li>
            <li>• You can reschedule or cancel up to 24 hours in advance</li>
          </ul>
        </div>
      </div>
    );
  };

  if (bookingComplete) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-2xl border border-border bg-card">
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle>Session Booking</CardTitle>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {renderConfirmation()}
            <div className="flex gap-3 mt-6">
              <Button onClick={onClose} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Close
              </Button>
              <Button variant="outline">
                Add to Calendar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-border bg-card">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Book a Session with a Human Coach</CardTitle>
              <CardDescription>
                Get personalized guidance from neurodiversity-trained professionals
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Progress indicator */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  step >= stepNum ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {stepNum}
                </div>
                {stepNum < 3 && (
                  <div className={`w-8 h-px mx-2 ${
                    step > stepNum ? 'bg-primary' : 'bg-muted'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {step === 1 && renderCoachSelection()}
          {step === 2 && renderSessionDetails()}
          {step === 3 && renderContactInfo()}

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            <Button 
              onClick={() => {
                if (step < 3) {
                  setStep(step + 1);
                } else {
                  handleBookSession();
                }
              }}
              disabled={
                (step === 1 && !selectedCoach) ||
                (step === 2 && (!sessionType || !selectedDate || !selectedTime))
              }
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {step === 3 ? 'Book Session' : 'Continue'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}