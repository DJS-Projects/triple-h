"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Volume2, VolumeX, Mic, MicOff } from 'lucide-react';

interface InterviewAvatarProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  currentQuestion?: string;
  onQuestionComplete?: () => void;
}

export default function InterviewAvatar({
  isListening = false,
  isSpeaking = false,
  onStartListening,
  onStopListening,
  currentQuestion,
  onQuestionComplete
}: InterviewAvatarProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const avatarRef = useRef<HTMLDivElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Speak the current question
  useEffect(() => {
    if (currentQuestion && !isMuted && audioEnabled) {
      speakQuestion(currentQuestion);
    }
  }, [currentQuestion, isMuted, audioEnabled]);

  const speakQuestion = async (text: string) => {
    try {
      // Stop any current speech
      if (speechRef.current) {
        speechSynthesis.cancel();
      }

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        utterance.volume = 0.8;
        
        // Wait for voices to load
        const voices = speechSynthesis.getVoices();
        let selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Female') || voice.name.includes('woman'))
        );
        
        if (!selectedVoice) {
          selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        
        utterance.onstart = () => {
          // Avatar animation start
          if (avatarRef.current) {
            avatarRef.current.classList.add('speaking');
          }
        };
        
        utterance.onend = () => {
          // Avatar animation end
          if (avatarRef.current) {
            avatarRef.current.classList.remove('speaking');
          }
          onQuestionComplete?.();
        };
        
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          if (avatarRef.current) {
            avatarRef.current.classList.remove('speaking');
          }
          onQuestionComplete?.();
        };
        
        speechRef.current = utterance;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error speaking question:', error);
      onQuestionComplete?.();
    }
  };

  const stopSpeaking = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    if (avatarRef.current) {
      avatarRef.current.classList.remove('speaking');
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (!isMuted) {
      stopSpeaking();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      onStopListening?.();
    } else {
      setIsRecording(true);
      onStartListening?.();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-6">
      {/* Avatar Display */}
      <div className="relative">
        <div
          ref={avatarRef}
          className={`
            w-40 h-40 rounded-full relative overflow-hidden shadow-2xl
            transition-all duration-300 ease-in-out
            ${isSpeaking || avatarRef.current?.classList.contains('speaking') 
              ? 'ring-4 ring-teal-500 ring-opacity-75 scale-105' 
              : 'ring-2 ring-gray-200'
            }
            ${isListening ? 'ring-4 ring-blue-500 ring-opacity-75' : ''}
          `}
        >
          {/* Avatar Image/Animation */}
          <div className="w-full h-full bg-gradient-to-br from-teal-400 via-teal-500 to-teal-600 flex items-center justify-center">
            <div className="text-white text-4xl font-bold">AI</div>
          </div>
          
          {/* Speaking Animation Overlay */}
          <div 
            className={`
              absolute inset-0 bg-gradient-to-br from-teal-300/30 to-teal-600/30
              transition-opacity duration-200
              ${isSpeaking || avatarRef.current?.classList.contains('speaking') 
                ? 'opacity-100 animate-pulse' 
                : 'opacity-0'
              }
            `}
          />
          
          {/* Listening Indicator */}
          {isListening && (
            <div className="absolute inset-0 border-4 border-blue-400 rounded-full animate-ping" />
          )}
        </div>

        {/* Status Indicators */}
        <div className="absolute -bottom-2 -right-2">
          {isSpeaking && (
            <div className="bg-teal-500 text-white p-2 rounded-full shadow-lg">
              <Volume2 className="w-4 h-4" />
            </div>
          )}
          {isListening && (
            <div className="bg-blue-500 text-white p-2 rounded-full shadow-lg animate-pulse">
              <Mic className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Avatar Info */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800">AI Interviewer</h3>
        <p className="text-sm text-gray-600">
          {isSpeaking ? 'Speaking...' : 
           isListening ? 'Listening...' : 
           'Ready for your interview'}
        </p>
      </div>

      {/* Audio Controls */}
      <div className="flex items-center space-x-4">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMute}
          className={`
            ${isMuted ? 'bg-red-50 border-red-200 text-red-600' : 'bg-gray-50'}
          `}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>

        {onStartListening && (
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            className="min-w-[100px]"
          >
            {isRecording ? <MicOff className="w-4 h-4 mr-1" /> : <Mic className="w-4 h-4 mr-1" />}
            {isRecording ? 'Stop' : 'Record'}
          </Button>
        )}

        {isSpeaking && (
          <Button
            variant="outline"
            size="sm"
            onClick={stopSpeaking}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            Skip
          </Button>
        )}
      </div>

      {/* Lip Sync Video Placeholder */}
      {/* In future implementation, this would show the Wav2Lips generated video */}
      <div className="hidden">
        <video
          className="w-40 h-40 rounded-full object-cover"
          autoPlay
          muted
          loop
        >
          <source src="/placeholder-lip-sync-video.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );
}

// CSS for speaking animation (to be added to globals.css)
export const avatarStyles = `
.speaking {
  animation: speakingPulse 1s ease-in-out infinite alternate;
}

@keyframes speakingPulse {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.7);
  }
  70% {
    transform: scale(1.02);
    box-shadow: 0 0 0 8px rgba(20, 184, 166, 0.3);
  }
  100% {
    transform: scale(1.05);
    box-shadow: 0 0 0 12px rgba(20, 184, 166, 0);
  }
}
`;
