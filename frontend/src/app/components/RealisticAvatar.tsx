"use client";

import Image from 'next/image';
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './button';
import { Volume2, VolumeX, Mic, MicOff, Loader2, Play, Pause } from 'lucide-react';

interface RealisticAvatarProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  onStartListening?: () => void;
  onStopListening?: () => void;
  currentQuestion?: string;
  onQuestionComplete?: () => void;
  size?: 'small' | 'medium' | 'large';
  imageUrl?: string;
}

export default function RealisticAvatar({
  isListening = false,
  isSpeaking = false,
  onStartListening,
  onStopListening,
  currentQuestion,
  onQuestionComplete,
  size = 'medium',
  imageUrl = ""
}: RealisticAvatarProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isLoadingLipSync, setIsLoadingLipSync] = useState(false);
  const [lipSyncVideoUrl, setLipSyncVideoUrl] = useState<string | null>(null);
  const [currentSpeechText, setCurrentSpeechText] = useState("");
  
  const avatarRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();

  // Size configurations
  const sizeConfig = {
    small: { 
      container: 'w-24 h-24', 
      text: 'text-lg',
      controls: 'text-xs',
      button: 'px-2 py-1 text-xs'
    },
    medium: { 
      container: 'w-40 h-40', 
      text: 'text-2xl',
      controls: 'text-sm',
      button: 'px-3 py-1 text-sm'
    },
    large: { 
      container: 'w-56 h-56', 
      text: 'text-3xl',
      controls: 'text-base',
      button: 'px-4 py-2 text-sm'
    }
  };

  const config = sizeConfig[size];

  // Initialize audio context for speech analysis
  useEffect(() => {
    if (typeof window !== 'undefined' && window.AudioContext) {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
    }
  }, []);

  // Speak the current question with Wav2Lips integration
  useEffect(() => {
    if (currentQuestion && !isMuted && audioEnabled) {
      speakQuestionWithLipSync(currentQuestion);
    }
  }, [currentQuestion, isMuted, audioEnabled]);

  const speakQuestionWithLipSync = async (text: string) => {
    try {
      setCurrentSpeechText(text);
      setIsLoadingLipSync(true);

      // Stop any current speech
      if (speechRef.current) {
        speechSynthesis.cancel();
      }

      // Generate lip-sync video using Wav2Lips (simulated)
      const lipSyncVideo = await generateLipSyncVideo(text, imageUrl);
      setLipSyncVideoUrl(lipSyncVideo);

      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Select a natural-sounding voice
        const voices = speechSynthesis.getVoices();
        let selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en') && 
          (voice.name.includes('Female') || voice.name.includes('Natural') || voice.name.includes('Neural'))
        );
        
        if (!selectedVoice) {
          selectedVoice = voices.find(voice => voice.lang.startsWith('en'));
        }
        
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        
        utterance.onstart = () => {
          setIsLoadingLipSync(false);
          startVisualAnimation();
          // Play lip-sync video if available
          if (videoRef.current && lipSyncVideoUrl) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(console.error);
          }
        };
        
        utterance.onend = () => {
          stopVisualAnimation();
          setLipSyncVideoUrl(null);
          onQuestionComplete?.();
        };
        
        utterance.onerror = (error) => {
          console.error('Speech synthesis error:', error);
          stopVisualAnimation();
          setIsLoadingLipSync(false);
          setLipSyncVideoUrl(null);
          onQuestionComplete?.();
        };
        
        speechRef.current = utterance;
        speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error('Error with lip-sync speech:', error);
      setIsLoadingLipSync(false);
      onQuestionComplete?.();
    }
  };

  // Real Wav2Lips API call
  const generateLipSyncVideo = async (text: string, imageUrl: string): Promise<string> => {
    try {
      console.log('🎬 Generating real lip-sync video...');
      console.log('Text:', text.substring(0, 50) + '...');
      console.log('Image:', imageUrl);
      
      // Make full URL for avatar image
      const fullAvatarUrl = imageUrl.startsWith('http') 
        ? imageUrl 
        : `${window.location.origin}${imageUrl}`;
      
      const response = await fetch('/api/wav2lip', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          avatarUrl: fullAvatarUrl,
          language: 'en'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate lip-sync video');
      }

      const result = await response.json();
      
      if (!result.video_url) {
        throw new Error('No video URL returned from lip-sync service');
      }

      console.log('✅ Lip-sync video generated successfully:', result.video_url);
      return result.video_url;
      
    } catch (error) {
      console.error('❌ Error generating lip-sync video:', error);
      
      // Fallback to simulated video for graceful degradation
      console.log('📝 Falling back to simulated lip-sync...');
      await new Promise(resolve => setTimeout(resolve, 1500));
      return `/Cheetat.mp4`; // Fallback to existing video in public folder
    }
  };

  const startVisualAnimation = () => {
    if (avatarRef.current) {
      avatarRef.current.classList.add('speaking');
    }
    
    // Start audio visualization if available
    if (analyserRef.current && audioContextRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const animate = () => {
        if (speechSynthesis.speaking) {
          analyserRef.current!.getByteFrequencyData(dataArray);
          
          // Calculate average volume
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const intensity = Math.min(average / 50, 2);
          
          // Apply visual effects based on audio intensity
          if (avatarRef.current) {
            avatarRef.current.style.transform = `scale(${1 + intensity * 0.05})`;
          }
          
          animationFrameRef.current = requestAnimationFrame(animate);
        }
      };
      
      animate();
    }
  };

  const stopVisualAnimation = () => {
    if (avatarRef.current) {
      avatarRef.current.classList.remove('speaking');
      avatarRef.current.style.transform = 'scale(1)';
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const stopSpeaking = () => {
    if (speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    stopVisualAnimation();
    setLipSyncVideoUrl(null);
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
            ${config.container} rounded-full relative overflow-hidden shadow-2xl
            transition-all duration-300 ease-in-out
            ${isSpeaking || avatarRef.current?.classList.contains('speaking') 
              ? 'ring-4 ring-blue-500 ring-opacity-75 shadow-blue-500/25' 
              : 'ring-2 ring-gray-200'
            }
            ${isListening ? 'ring-4 ring-green-500 ring-opacity-75 shadow-green-500/25' : ''}
            ${isLoadingLipSync ? 'ring-4 ring-purple-500 ring-opacity-75 shadow-purple-500/25' : ''}
          `}
        >
          {/* Lip-Sync Video Layer */}
          {lipSyncVideoUrl && !isLoadingLipSync && (
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover z-10"
              autoPlay
              muted
              playsInline
              onEnded={() => setLipSyncVideoUrl(null)}
            >
              <source src={lipSyncVideoUrl} type="video/mp4" />
            </video>
          )}
          
          {/* Static Avatar Image */}
            <div className={`
            w-full h-full relative
            ${lipSyncVideoUrl && !isLoadingLipSync ? 'opacity-0' : 'opacity-100'}
            transition-opacity duration-300
            `}>
            <Image
                src={imageUrl || "/TalentSpectrumLogo.png"}
                alt="AI Interviewer Avatar"
                fill
                className="object-cover rounded-full"
                priority
            />
            </div>

          
          {/* Loading Overlay */}
          {isLoadingLipSync && (
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="text-center text-white">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                <div className="text-xs">Preparing response...</div>
              </div>
            </div>
          )}
          
          {/* Speaking Animation Overlay */}
          <div 
            className={`
              absolute inset-0 bg-gradient-to-br from-blue-400/20 to-purple-600/20
              transition-opacity duration-200 rounded-full
              ${isSpeaking || avatarRef.current?.classList.contains('speaking') 
                ? 'opacity-100 animate-pulse' 
                : 'opacity-0'
              }
            `}
          />
          
          {/* Listening Indicator */}
          {isListening && (
            <div className="absolute inset-0">
              <div className="absolute inset-0 border-4 border-green-400 rounded-full animate-ping opacity-75" />
              <div className="absolute inset-2 border-2 border-green-300 rounded-full animate-pulse" />
            </div>
          )}
        </div>

        {/* Status Indicators */}
        <div className="absolute -bottom-2 -right-2 flex space-x-1">
          {isSpeaking && (
            <div className="bg-blue-500 text-white p-2 rounded-full shadow-lg animate-pulse">
              <Volume2 className="w-4 h-4" />
            </div>
          )}
          {isListening && (
            <div className="bg-green-500 text-white p-2 rounded-full shadow-lg animate-bounce">
              <Mic className="w-4 h-4" />
            </div>
          )}
          {isLoadingLipSync && (
            <div className="bg-purple-500 text-white p-2 rounded-full shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Avatar Info */}
      <div className="text-center">
        <h3 className={`${config.text} font-semibold text-gray-800 mb-1`}>
          AI Interviewer
        </h3>
        <p className={`${config.controls} text-gray-600`}>
          {isLoadingLipSync ? 'Preparing response...' :
           isSpeaking ? 'Speaking...' : 
           isListening ? 'Listening...' : 
           'Ready for your interview'}
        </p>
        
        {/* Current Speech Text Display */}
        {currentSpeechText && isSpeaking && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 max-w-xs">
            <p className="text-xs text-blue-700 italic">
              "{currentSpeechText.substring(0, 50)}..."
            </p>
          </div>
        )}
      </div>

      {/* Enhanced Audio Controls */}
      <div className="flex items-center space-x-3">
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMute}
          className={`
            ${config.button}
            ${isMuted ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'}
          `}
        >
          {isMuted ? <VolumeX className="w-4 h-4 mr-1" /> : <Volume2 className="w-4 h-4 mr-1" />}
          {isMuted ? 'Unmute' : 'Mute'}
        </Button>

        {onStartListening && (
          <Button
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={toggleRecording}
            className={`${config.button} min-w-[80px]`}
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
            className={`${config.button} text-orange-600 border-orange-200 hover:bg-orange-50`}
          >
            <Pause className="w-4 h-4 mr-1" />
            Skip
          </Button>
        )}
      </div>

      {/* Technical Info (Development Only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg text-xs text-gray-600 max-w-xs">
          <div className="font-medium mb-1">Debug Info:</div>
          <div>Lip-sync: {lipSyncVideoUrl ? '✅ Active' : '❌ Inactive'}</div>
          <div>Audio: {speechSynthesis.speaking ? '🔊 Speaking' : '🔇 Silent'}</div>
          <div>Size: {size}</div>
        </div>
      )}
    </div>
  );
}
