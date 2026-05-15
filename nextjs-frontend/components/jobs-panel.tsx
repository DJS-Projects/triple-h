"use client";

import {
	AlertTriangle,
	CheckCircle2,
	CircleSlash,
	Loader2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cancelJob, deleteDocument } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { SubmittedJob } from "@/components/upload-dropzone";

// SSE frame shape — mirrors backend JobStatusResponse. Pinned to the
// fields this component actually uses so openapi regen churn doesn't ripple
// through unless a field this view depends on changes.
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
	hydrated: boolean;
}

function stageLabel(frame: JobFrame | null, fallback: string): string {
	if (!frame) return fallback;
	if (frame.status === "pending") return "Queued";
	if (frame.status === "succeeded") return "Done";
	if (frame.status === "failed") {
		return frame.error?.startsWith("cancelled") ? "Cancelled" : "Failed";
	}
	// Granular stages emitted by extract_structured via the on_stage hook.
	// `pipeline` is the legacy outer-worker stage; it shows briefly before
	// the pipeline overwrites with the first inner stage (classifying / ocr).
	switch (frame.stage) {
		case "classifying":
			return "Classifying document";
		case "ocr":
			return "Reading text (OCR)";
		case "anchoring":
			return "Finding fields";
		case "extracting":
			return "Extracting with LLM";
		case "postprocess":
			return "Formatting";
		case "pipeline":
			return "Starting extraction";
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

// State icon shown on the left of each row. Augments the textual status
// with a quick-scan visual so users can read down the list and tell at a
// glance which rows are alive vs done.
function StateIcon({ frame }: { frame: JobFrame | null }) {
	const status = frame?.status;
	const cancelled = frame?.error?.startsWith("cancelled");
	if (!status || status === "pending" || status === "running") {
		return (
			<Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-blue" />
		);
	}
	if (status === "succeeded") {
		return (
			<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
		);
	}
	if (cancelled) {
		return (
			<CircleSlash className="h-4 w-4 shrink-0 text-muted-foreground" />
		);
	}
	return <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />;
}

interface JobRowProps {
	job: SubmittedJob;
	selected: boolean;
	selectMode: boolean;
	onToggleSelect: (jobId: string) => void;
	onRemove: (jobId: string) => void;
}

function JobRow({
	job,
	selected,
	selectMode,
	onToggleSelect,
	onRemove,
}: JobRowProps) {
	const [frame, setFrame] = useState<JobFrame | null>(null);
	const [, setTick] = useState(0);
	const [cancelPending, setCancelPending] = useState(false);
	const esRef = useRef<EventSource | null>(null);

	// SSE subscription — one per job, closes on terminal frame or unmount.
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
			// Don't auto-close on transient error; the SSE retry hint lets
			// the browser reconnect. If it stays dead, the user can dismiss.
		};
		return () => {
			es.close();
			esRef.current = null;
		};
	}, [job.job_id]);

	// Re-render every 500ms while in-flight so the elapsed counter ticks.
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

	// Cancel = stop the job AND clean up the document so it doesn't sit
	// stranded in `uploaded` state (rendered as "queued" forever) in the
	// recent-uploads list below. CASCADE on extraction_job.document_id
	// means deleting the document removes the job row too, so we don't
	// need a second cancel call after delete.
	//
	// Skip the document delete when this row was a deduped re-submission
	// against an existing document — the doc may have prior successful
	// extraction_runs we mustn't destroy. In that case we only cancel
	// the job (legacy behavior), leaving the underlying doc intact.
	const handleCancel = async () => {
		const confirmMsg = job.deduped
			? `Cancel extraction for "${job.filename}"? The document will remain.`
			: `Cancel and discard "${job.filename}"? This removes the upload and cannot be undone.`;
		if (!window.confirm(confirmMsg)) return;

		setCancelPending(true);
		const cancelResult = await cancelJob(job.job_id);
		// Discriminate on the success-shape field (`job_id`), NOT on the
		// presence of `error` — JobStatusResponse always has an `error`
		// field which after a successful cancel is set to "cancelled by
		// user". Checking `"error" in cancelResult` would misread that
		// as an HTTP failure even though the cancel actually worked.
		if (!("job_id" in cancelResult)) {
			setCancelPending(false);
			window.alert(`Cancel failed: ${cancelResult.error}`);
			return;
		}
		setFrame(cancelResult as JobFrame);

		if (job.deduped) {
			setCancelPending(false);
			return;
		}

		const deleteResult = await deleteDocument(job.document_id);
		setCancelPending(false);
		if ("error" in deleteResult) {
			// Job is cancelled; doc remains. Surface so the user can retry
			// the delete manually from the Documents page if they want
			// the upload gone entirely.
			window.alert(
				`Cancelled, but failed to remove the document: ${deleteResult.error}`,
			);
			return;
		}
		onRemove(job.job_id);
	};

	return (
		<li
			className={`grid items-center gap-3 px-4 py-3 ${
				selectMode
					? "grid-cols-[1.25rem_minmax(0,1fr)_1.5rem]"
					: "grid-cols-[1.25rem_minmax(0,1fr)]"
			}`}
		>
			<div className="flex items-center justify-center">
				<StateIcon frame={frame} />
			</div>

			<div className="min-w-0">
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
				<div className="flex flex-wrap items-baseline gap-x-2 font-mono text-xs">
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
					{/* Inline action link: cancel while active, dismiss when
					    terminal. Hyperlink-styled rather than buttons so it
					    blends with the status line. */}
					<span className="text-muted-foreground">·</span>
					{active ? (
						<button
							type="button"
							onClick={handleCancel}
							disabled={cancelPending}
							className="text-muted-foreground underline-offset-2 hover:text-destructive hover:underline disabled:opacity-50"
						>
							{cancelPending ? "cancelling…" : "cancel"}
						</button>
					) : (
						<button
							type="button"
							onClick={() => onRemove(job.job_id)}
							className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
						>
							dismiss
						</button>
					)}
				</div>
				{frame?.status === "failed" &&
				!frame.error?.startsWith("cancelled") ? (
					<p className="mt-1 truncate font-mono text-[11px] text-destructive">
						{frame.error}
					</p>
				) : null}
			</div>

			{/* Right-side checkbox — only rendered while the panel is in
			    select mode. Disabled for non-terminal rows since bulk
			    dismiss only makes sense after the job has finished. */}
			{selectMode ? (
				<label className="flex items-center justify-center">
					<input
						type="checkbox"
						checked={selected}
						onChange={() => onToggleSelect(job.job_id)}
						disabled={!terminal}
						aria-label={
							terminal
								? `select ${job.filename} for bulk dismiss`
								: `${job.filename} cannot be selected while active`
						}
						className="h-4 w-4 cursor-pointer rounded border-input accent-brand-blue disabled:cursor-not-allowed disabled:opacity-30"
					/>
				</label>
			) : null}
		</li>
	);
}

export function JobsPanel({ jobs, onRemove, hydrated }: JobsPanelProps) {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	// Select mode hides the checkboxes by default — the user opts in via
	// the "Select" toggle in the header. Bulk operations only make sense
	// when the user is intentionally curating the list, so keeping it off
	// by default lets the panel stay scannable in the common case.
	const [selectMode, setSelectMode] = useState(false);

	// Drop selections when their underlying row leaves the list. Otherwise
	// stale ids would accumulate and the bulk-dismiss bar would lie about
	// the count.
	useEffect(() => {
		const present = new Set(jobs.map((j) => j.job_id));
		setSelected((prev) => {
			const next = new Set<string>();
			for (const id of prev) if (present.has(id)) next.add(id);
			return next.size === prev.size ? prev : next;
		});
	}, [jobs]);

	const onToggleSelect = (jobId: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(jobId)) next.delete(jobId);
			else next.add(jobId);
			return next;
		});
	};

	const dismissSelected = () => {
		for (const id of selected) onRemove(id);
		setSelected(new Set());
	};

	// "Select all" only applies to dismissable rows. Active jobs aren't
	// selectable (they can't be dismissed mid-run), so calling toggle on
	// every row would be misleading. Filter to terminal first.
	const selectAllTerminal = () => {
		const terminalJobs = jobs.filter((j) => {
			// We don't know the SSE-derived live status here, only the
			// initial dedup_status the row was seeded with. That's the
			// best signal available at the panel level — rows whose live
			// state has since flipped to terminal will just need an extra
			// click. Worth-it trade for not lifting per-row SSE state up.
			return j.dedup_status === "succeeded" || j.dedup_status === "failed";
		});
		setSelected(new Set(terminalJobs.map((j) => j.job_id)));
	};

	const exitSelectMode = () => {
		setSelectMode(false);
		setSelected(new Set());
	};

	const selectedCount = useMemo(() => selected.size, [selected]);

	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				{/* Left column: stacked title + meta. Right column: action
				    buttons aligned to vertical center of the two text rows. */}
				<div className="flex min-w-0 flex-col gap-1">
					<h2 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-brand-blue">
						Active jobs{jobs.length > 0 ? ` (${jobs.length})` : ""}
					</h2>
					<p className="font-mono text-[11px] text-muted-foreground">
						Live status via SSE · click filename to open finished docs
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{selectMode ? (
						<>
							<Button size="sm" onClick={selectAllTerminal}>
								Select all
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={exitSelectMode}
							>
								Done
							</Button>
						</>
					) : jobs.length > 0 ? (
						<Button size="sm" onClick={() => setSelectMode(true)}>
							Select
						</Button>
					) : null}
				</div>
			</div>

			{/* Bulk bar + list share a single border container so the bar
			    sits flush above the list with no gap. Their internal
			    separator is a horizontal rule rather than two stacked
			    border-y edges. */}
			<div className="flex flex-col border-y">
				{selectMode && selectedCount > 0 ? (
					<div className="flex items-center justify-between gap-3 border-b bg-muted/30 py-2 pl-4 pr-0">
						<p className="font-mono text-xs text-muted-foreground">
							{selectedCount} selected
						</p>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => setSelected(new Set())}
							>
								Clear
							</Button>
							<Button size="sm" onClick={dismissSelected}>
								Dismiss {selectedCount}
							</Button>
						</div>
					</div>
				) : null}

				{!hydrated ? (
					<p className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
						Loading recent jobs…
					</p>
				) : jobs.length === 0 ? (
					<p className="px-4 py-6 text-center font-mono text-xs text-muted-foreground">
						No jobs yet. Stage PDFs above and click Submit to queue.
					</p>
				) : (
					<ul className="flex flex-col divide-y">
						{jobs.map((job) => (
							<JobRow
								key={job.job_id}
								job={job}
								selected={selected.has(job.job_id)}
								selectMode={selectMode}
								onToggleSelect={onToggleSelect}
								onRemove={onRemove}
							/>
						))}
					</ul>
				)}
			</div>
		</section>
	);
}
