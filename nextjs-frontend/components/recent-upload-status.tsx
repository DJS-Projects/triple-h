"use client";

import {
	AlertTriangle,
	CheckCircle2,
	CircleSlash,
	Eye,
	Loader2,
} from "lucide-react";

// Render a per-row status indicator for the recent-uploads list. Maps the
// backend doc_status enum to an icon + label so users can tell at a glance
// whether the extraction finished, is still running, or broke. Stays a
// client component so the icons (and any future tooltip / pulse animation)
// can use interactive primitives without making the page client-rendered.

interface RecentUploadStatusProps {
	status: string;
}

export function RecentUploadStatus({ status }: RecentUploadStatusProps) {
	switch (status) {
		case "processing":
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-brand-blue">
					<Loader2 className="h-3 w-3 animate-spin" />
					processing
				</span>
			);
		case "extracted":
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700">
					<CheckCircle2 className="h-3 w-3" />
					extracted
				</span>
			);
		case "reviewed":
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-emerald-700">
					<Eye className="h-3 w-3" />
					reviewed
				</span>
			);
		case "failed":
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-destructive">
					<AlertTriangle className="h-3 w-3" />
					failed
				</span>
			);
		case "rejected":
			// Classifier said "this isn't a supported document type".
			// Terminal-but-not-broken state — muted slash icon, no spinner.
			// User retries with explicit doc_type override or discards.
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
					<CircleSlash className="h-3 w-3" />
					rejected
				</span>
			);
		case "cancelled":
			// User cancelled mid-pipeline. Same visual treatment as
			// rejected — terminal, opt-in to retry or discard.
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
					<CircleSlash className="h-3 w-3" />
					cancelled
				</span>
			);
		case "uploaded":
		default:
			// `uploaded` = blob persisted but no job has started yet. Same
			// spinner visual as `processing` so the user still sees motion
			// while the worker picks the row up — better than a stale label
			// that looks like "broken".
			return (
				<span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
					<Loader2 className="h-3 w-3 animate-spin" />
					queued
				</span>
			);
	}
}
