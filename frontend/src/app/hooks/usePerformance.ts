"use client";

import { useState, useEffect, useCallback } from "react";

// Hook for managing loading states and performance optimization
export function usePerformance() {
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Simulate data loading with configurable delay
  const simulateLoading = useCallback((delay: number = 1000) => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  // Preload critical resources
  const preloadResources = useCallback((urls: string[]) => {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = url.endsWith('.css') ? 'style' : 'image';
      document.head.appendChild(link);
    });
  }, []);

  // Debounce function for performance
  const debounce = useCallback((func: Function, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  }, []);

  // Throttle function for performance
  const throttle = useCallback((func: Function, delay: number) => {
    let lastCall = 0;
    return (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        func.apply(null, args);
      }
    };
  }, []);

  return {
    isLoading,
    setIsLoading,
    isHydrated,
    simulateLoading,
    preloadResources,
    debounce,
    throttle,
  };
}

// Hook for lazy loading components
export function useLazyLoad(threshold: number = 0.1) {
  const [isVisible, setIsVisible] = useState(false);
  const [ref, setRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(ref);

    return () => observer.disconnect();
  }, [ref, threshold]);

  return { ref: setRef, isVisible };
}

// Hook for caching data
export function useCache<T>(key: string, fetcher: () => Promise<T>, ttl: number = 5 * 60 * 1000) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getCachedData = useCallback(() => {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data: cachedData, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < ttl) {
          return cachedData;
        }
      }
    } catch (error) {
      console.warn('Failed to get cached data:', error);
    }
    return null;
  }, [key, ttl]);

  const setCachedData = useCallback((data: T) => {
    try {
      localStorage.setItem(key, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }, [key]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
        return;
      }

      const result = await fetcher();
      setData(result);
      setCachedData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher, getCachedData, setCachedData]);

  return {
    data,
    isLoading,
    error,
    fetchData,
    clearCache: () => localStorage.removeItem(key),
  };
}
