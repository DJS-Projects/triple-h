"use client";

import { Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cancelJob } from "@/lib/api";
import type { SubmittedJob } from "@/components/upload-dropzone";

// SSE frame shape — mirrors backend JobStatusResponse. We keep this typed
// in-component (instead of importing from openapi-client) because it's
// already a server-validated shape; pinning the relevant fields keeps the
// component decoupled from openapi regen churn.
interface JobFrame {
	job_id: string;
	document_id: string;
	status: "pending" | "running" | "succeeded" | "failed";
	stage: string | null;
	error: string | null;
	run_id: number | null;
	attempts: number;
	created_at: string;
	started_at: string | null;
	finished_at: string | null;
}

interface JobsPanelProps {
	jobs: SubmittedJob[];
	onRemove: (jobId: string) => void;
	// false during the initial hydration fetch so the panel can render a
	// neutral loading line instead of a misleading "No jobs yet" state.
	hydrated: boolean;
}

function stageLabel(frame: JobFrame | null, fallback: string): string {
	if (!frame) return fallback;
	if (frame.status === "pending") return "Queued";
	if (frame.status === "succeeded") return "Done";
	if (frame.status === "failed") {
		return frame.error?.startsWith("cancelled") ? "Cancelled" : "Failed";
	}
	switch (frame.stage) {
		case "pipeline":
			return "OCR + LLM extraction";
		case "persist":
			return "Saving";
		default:
			return "Processing";
	}
}

function statusTone(frame: JobFrame | null): string {
	if (!frame) return "text-muted-foreground";
	switch (frame.status) {
		case "succeeded":
			return "text-emerald-700";
		case "failed":
			return frame.error?.startsWith("cancelled")
				? "text-muted-foreground"
				: "text-destructive";
		case "running":
			return "text-brand-blue";
		default:
			return "text-muted-foreground";
	}
}

function durationLabel(frame: JobFrame | null, submittedAt: number): string {
	if (frame?.finished_at) {
		const startedISO = frame.started_at ?? frame.created_at;
		const start = startedISO ? new Date(startedISO).getTime() : submittedAt;
		const end = new Date(frame.finished_at).getTime();
		const ms = Math.max(0, end - start);
		return `${(ms / 1000).toFixed(1)}s`;
	}
	const elapsed = Math.max(0, Date.now() - submittedAt) / 1000;
	return `${elapsed.toFixed(1)}s`;
}

function JobRow({
	job,
	onRemove,
}: {
	job: SubmittedJob;
	onRemove: (jobId: string) => void;
}) {
	const [frame, setFrame] = useState<JobFrame | null>(null);
	const [, setTick] = useState(0); // ticker for live duration on running jobs
	const [cancelPending, setCancelPending] = useState(false);
	const esRef = useRef<EventSource | null>(null);

	// SSE subscription — one per job, closes on terminal frame or unmount.
	// The /api/jobs/[id]/stream proxy forwards the backend's poll-based
	// stream, so each row gets ~500ms-latency updates.
	useEffect(() => {
		const es = new EventSource(`/api/jobs/${job.job_id}/stream`);
		esRef.current = es;
		es.addEventListener("status", (evt: MessageEvent<string>) => {
			try {
				const next = JSON.parse(evt.data) as JobFrame;
				setFrame(next);
				if (next.status === "succeeded" || next.status === "failed") {
					es.close();
					esRef.current = null;
				}
			} catch {
				// ignore malformed frame; stream stays open
			}
		});
		es.onerror = () => {
			// Don't auto-close on transient error; the browser will retry per
			// the SSE retry hint. If it stays dead, the user can dismiss the
			// row and refetch by-id later.
		};
		return () => {
			es.close();
			esRef.current = null;
		};
	}, [job.job_id]);

	// Re-render every 500ms while a job is in flight so the elapsed counter
	// stays live without piping per-frame snapshots from the backend.
	useEffect(() => {
		if (frame && (frame.status === "succeeded" || frame.status === "failed")) {
			return;
		}
		const id = setInterval(() => setTick((t) => t + 1), 500);
		return () => clearInterval(id);
	}, [frame]);

	const active =
		!frame || frame.status === "pending" || frame.status === "running";
	const terminal =
		frame && (frame.status === "succeeded" || frame.status === "failed");
	const succeeded = frame?.status === "succeeded";

	const handleCancel = async () => {
		setCancelPending(true);
		const result = await cancelJob(job.job_id);
		setCancelPending(false);
		if (!("error" in result)) {
			// Server returned the (possibly updated) snapshot — reflect it
			// immediately instead of waiting for the next SSE tick.
			setFrame(result as JobFrame);
		}
	};

	return (
		<li className="flex items-center gap-3 px-4 py-3">
			<div className="flex w-4 shrink-0 items-center justify-center">
				{active ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin text-brand-blue" />
				) : null}
			</div>

			<div className="min-w-0 flex-1">
				<div className="flex items-baseline gap-2">
					{succeeded ? (
						<Link
							href={`/documents/${job.document_id}`}
							className="truncate text-sm font-medium hover:underline"
						>
							{job.filename}
						</Link>
					) : (
						<p className="truncate text-sm font-medium">{job.filename}</p>
					)}
					<span className="font-mono text-[11px] text-muted-foreground">
						{job.model}
					</span>
				</div>
				<div className="flex items-baseline gap-2 font-mono text-xs">
					<span className={statusTone(frame)}>
						{stageLabel(frame, job.dedup_status)}
					</span>
					<span className="text-muted-foreground">·</span>
					<span className="tabular-nums text-muted-foreground">
						{durationLabel(frame, job.submitted_at)}
					</span>
					{frame && frame.attempts > 1 ? (
						<>
							<span className="text-muted-foreground">·</span>
							<span className="text-muted-foreground">
								retry #{frame.attempts - 1}
							</span>
						</>
					) : null}
					{job.deduped ? (
						<>
							<span className="text-muted-foreground">·</span>
							<span className="text-muted-foreground">deduped</span>
						</>
					) : null}
				</div>
				{frame?.status === "failed" &&
				!frame.error?.startsWith("cancelled") ? (
					<p className="mt-1 truncate font-mono text-[11px] text-destructive">
						{frame.error}
					</p>
				) : null}
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{active ? (
					<button
						type="button"
						onClick={handleCancel}
						disabled={cancelPending}
						className="rounded-md border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
					>
						{cancelPending ? "…" : "cancel"}
					</button>
				) : null}
				{succeeded ? (
					<Link
						href={`/documents/${job.document_id}`}
						className="rounded-md border px-2 py-1 font-mono text-[11px] text-foreground hover:bg-muted"
					>
						open →
					</Link>
				) : null}
				{terminal ? (
					<button
						type="button"
						onClick={() => onRemove(job.job_id)}
						className="rounded-md p-1 text-muted-foreground hover:text-foreground"
						aria-label="dismiss"
					>
						<X className="h-3.5 w-3.5" />
					</button>
				) : null}
			</div>
		</li>
	);
}

export function JobsPanel({ jobs, onRemove, hydrated }: JobsPanelProps) {
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-baseline justify-between">
				<h2 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-brand-blue">
					Active jobs{jobs.length > 0 ? ` (${jobs.length})` : ""}
				</h2>
				<p className="font-mono text-[11px] text-muted-foreground">
					Live status via SSE · click filename to open finished docs
				</p>
			</div>
			{!hydrated ? (
				<p className="border-y px-4 py-6 text-center font-mono text-xs text-muted-foreground">
					Loading recent jobs…
				</p>
			) : jobs.length === 0 ? (
				<p className="border-y px-4 py-6 text-center font-mono text-xs text-muted-foreground">
					No jobs yet. Stage PDFs above and click Submit to queue.
				</p>
			) : (
				<ul className="flex flex-col divide-y border-y">
					{jobs.map((job) => (
						<JobRow key={job.job_id} job={job} onRemove={onRemove} />
					))}
				</ul>
			)}
		</section>
	);
}
