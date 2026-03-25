"use client";

import React from "react";
import { MapPin, Clock, Building2, DollarSign } from "lucide-react";
import { Card } from "@/app/components/card";
import { Button } from "@/app/components/button";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string;
    location: string;
    type: string;
    salary: string;
    description: string;
    posted: string;
    isRemote?: boolean;
    isFlexible?: boolean;
    hasAccommodations?: boolean;
    isInclusive?: boolean;
  };
  onJobClick: (id: string) => void;
  viewMode: "grid" | "list";
}

export default function JobCard({ job, onJobClick, viewMode }: JobCardProps) {
  return (
    <Card
      className={`cursor-pointer border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition-all duration-300 ${
        viewMode === "list"
          ? "flex flex-col sm:flex-row justify-between p-6"
          : "p-6 h-full flex flex-col"
      }`}
      onClick={() => onJobClick(job.id)}
    >
      <div className="flex flex-col flex-grow">
        {/* Title + Company */}
        <h3 className="text-lg font-semibold text-gray-800">{job.title}</h3>
        <p className="text-sm text-gray-500 mb-3">{job.company}</p>

        {/* Location, Type, Salary */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <MapPin className="h-4 w-4 text-indigo-600" />
            {job.location}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-indigo-600" />
            {job.type}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-4 w-4 text-indigo-600" />
            {job.salary}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-600 line-clamp-2 mb-4">
          {job.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {job.isRemote && (
            <span className="px-3 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded-full border border-blue-100">
              Remote
            </span>
          )}
          {job.isFlexible && (
            <span className="px-3 py-1 text-xs font-medium bg-green-50 text-green-600 rounded-full border border-green-100">
              Flexible
            </span>
          )}
          {job.hasAccommodations && (
            <span className="px-3 py-1 text-xs font-medium bg-purple-50 text-purple-600 rounded-full border border-purple-100">
              Accommodations
            </span>
          )}
          {job.isInclusive && (
            <span className="px-3 py-1 text-xs font-medium bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
              Inclusive
            </span>
          )}
        </div>

        {/* Footer: Posted + CTA */}
        <div className="flex items-center justify-between mt-auto">
          <p className="text-xs text-gray-400">Posted {job.posted}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-[#635bff] text-[#635bff] hover:bg-[#635bff] hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                onJobClick(job.id);
              }}
            >
              View Details
            </Button>
            <Button
              size="sm"
              className="bg-[#635bff] hover:bg-indigo-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/jobs/${job.id}/apply`;
              }}
            >
              Apply Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
