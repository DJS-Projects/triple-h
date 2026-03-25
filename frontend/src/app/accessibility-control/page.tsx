"use client";

import React, { useRef } from 'react';
import { Moon, Sun, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/app/components/button';
import { Separator } from '@/app/components/separator';
import gsap from 'gsap';

interface AccessibilityControlsProps {
  darkMode: boolean;
  setDarkMode: (value: boolean) => void;
  distractionFree: boolean;
  setDistractionFree: (value: boolean) => void;
}

export function AccessibilityControls({
  darkMode,
  setDarkMode,
  distractionFree,
  setDistractionFree
}: AccessibilityControlsProps) {
  const darkModeWrapperRef = useRef<HTMLDivElement>(null);
  const distractionFreeWrapperRef = useRef<HTMLDivElement>(null);

  const handleDarkModeClick = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && darkModeWrapperRef.current) {
      gsap.fromTo(darkModeWrapperRef.current,
        { scale: 1 },
        { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
    setDarkMode(!darkMode);
  };

  const handleDistractionFreeClick = () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!prefersReducedMotion && distractionFreeWrapperRef.current) {
      gsap.fromTo(distractionFreeWrapperRef.current,
        { scale: 1 },
        { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
    setDistractionFree(!distractionFree);
  };

  return (
    <div className="flex items-center gap-2 p-2 bg-muted border border-border rounded-lg">
      <div ref={darkModeWrapperRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDarkModeClick}
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
          className="text-foreground hover:text-foreground"
        >
          {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      
      <Separator orientation="vertical" className="h-6" />
      
      <div ref={distractionFreeWrapperRef}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDistractionFreeClick}
          aria-label="Toggle distraction-free mode"
          title="Toggle distraction-free mode"
          className="text-foreground hover:text-foreground"
        >
          {distractionFree ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}