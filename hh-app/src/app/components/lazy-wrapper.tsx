"use client";

import React, { Suspense, lazy, ComponentType } from "react";
import { Skeleton } from "./loading-skeleton";

// Higher-order component for lazy loading
export function withLazyLoading<T extends object>(
  Component: ComponentType<T>,
  fallback?: React.ReactNode
) {
  return function LazyComponent(props: T) {
    return (
      <Suspense fallback={fallback || <Skeleton className="h-64 w-full" />}>
        <Component {...props} />
      </Suspense>
    );
  };
}

// Lazy wrapper for any component
export function LazyWrapper({ 
  children, 
  fallback 
}: { 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <Suspense fallback={fallback || <Skeleton className="h-64 w-full" />}>
      {children}
    </Suspense>
  );
}

// Lazy load heavy components
export const LazyJobCard = lazy(() => import("./job-card"));
export const LazyCandidateProfile = lazy(() => import("./candidate-profile"));
export const LazyEmployerDashboard = lazy(() => import("./employer-dashboard"));

// Intersection Observer based lazy loading
export function LazyLoadWrapper({ 
  children, 
  threshold = 0.1,
  fallback 
}: { 
  children: React.ReactNode;
  threshold?: number;
  fallback?: React.ReactNode;
}) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [ref, setRef] = React.useState<HTMLDivElement | null>(null);

  React.useEffect(() => {
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

  return (
    <div ref={setRef}>
      {isVisible ? children : (fallback || <Skeleton className="h-64 w-full" />)}
    </div>
  );
}
