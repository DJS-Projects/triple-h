"use client";

import React from "react";

// Generic skeleton component
export function Skeleton({ 
  className = "", 
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`animate-pulse bg-gray-200 rounded ${className}`}
      {...props}
    />
  );
}

// Card skeleton for job listings
export function JobCardSkeleton() {
  return (
    <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-[#f0eef5] p-6">
      <div className="flex justify-center mb-4">
        <Skeleton className="w-20 h-20 rounded" />
      </div>
      <Skeleton className="h-6 w-3/4 mx-auto mb-2" />
      <div className="space-y-1">
        <Skeleton className="h-4 w-1/2 mx-auto" />
        <Skeleton className="h-4 w-2/3 mx-auto" />
        <Skeleton className="h-4 w-1/3 mx-auto" />
        <Skeleton className="h-10 w-24 mx-auto mt-3 rounded-full" />
      </div>
    </div>
  );
}

// Profile skeleton for candidate dashboard
export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div>
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="w-full h-2 rounded-full" />
      </div>
      
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// Page loading skeleton
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50 to-background">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <Skeleton className="h-8 w-1/3" />
          <div className="grid md:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <Skeleton className="h-8 w-8 mx-auto mb-2" />
                <Skeleton className="h-6 w-16 mx-auto mb-1" />
                <Skeleton className="h-4 w-24 mx-auto" />
              </div>
            ))}
          </div>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <Skeleton className="h-6 w-1/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Form skeleton
export function FormSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i}>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <Skeleton className="h-10 w-32 rounded-lg" />
    </div>
  );
}
