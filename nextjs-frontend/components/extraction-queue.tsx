"use client";

import { useCallback, useEffect, useState } from "react";
import { JobsPanel } from "@/components/jobs-panel";
import {
	type SubmittedJob,
	UploadDropzone,
} from "@/components/upload-dropzone";
import { fetchRecentJobs } from "@/lib/api";

// LocalStorage key for the per-browser dismissed-ids set. Without this,
// dismissing a job is forgotten the moment the page reloads — the
// backend still has the row, hydration brings it right back, and the
// "dismiss" gesture feels broken. Persisting on the client is fine
// because dismiss is purely cosmetic (no server-side dismissal state
// today; that would require a doc_status enum extension + migration).
const DISMISSED_STORAGE_KEY = "triple_h.dismissed_job_ids.v1";

function loadDismissed(): Set<string> {
	if (typeof window === "undefined") return new Set();
	try {
		const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
		if (!raw) return new Set();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return new Set();
		return new Set(parsed.filter((x): x is string => typeof x === "string"));
	} catch {
		return new Set();
	}
}

function saveDismissed(ids: Set<string>): void {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			DISMISSED_STORAGE_KEY,
			JSON.stringify(Array.from(ids)),
		);
	} catch {
		// quota or disabled storage — silent, dismiss falls back to
		// session-only behavior which is the same as the prior bug.
	}
}

// Top-of-page client wrapper that pairs the upload dropzone with the live
// jobs panel. Hydrates jobs[] from the backend on mount so a refresh
// doesn't drop visibility on jobs already in flight.
//
// Hydration policy:
//   - Pull pending + running + recent succeeded + recent failed
//   - 50-row cap (server-enforced); newest-first
//   - User-dismissed rows are session-only — refresh re-fetches them
//     unless they've aged out of the limit
//
// In-session submissions append via onJobSubmitted and dedup by job_id
// against the hydrated set so a re-upload of an already-tracked job
// just refreshes the existing row instead of duplicating it.

export function ExtractionQueue() {
	const [jobs, setJobs] = useState<SubmittedJob[]>([]);
	const [hydrated, setHydrated] = useState(false);
	// Mirror of localStorage dismissed-ids. Kept in component state so the
	// filtering re-renders when dismissals change; localStorage stays in
	// sync via the saveDismissed call inside onRemove.
	const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

	// Hydrate from localStorage on mount. Reading inside useEffect keeps
	// the component SSR-safe (window is unavailable during server render).
	useEffect(() => {
		setDismissed(loadDismissed());
	}, []);

	// On-mount hydration. Best-effort: if the listing call fails we just
	// start with an empty queue rather than blocking the dropzone.
	// Hydration filters out previously-dismissed ids so a refresh after a
	// dismiss doesn't make the row pop back into view.
	useEffect(() => {
		let cancelled = false;
		fetchRecentJobs().then((res) => {
			if (cancelled) return;
			if ("error" in res) {
				setHydrated(true);
				return;
			}
			const persisted = loadDismissed();
			const seeded: SubmittedJob[] = res
				.filter((item) => !persisted.has(item.job_id))
				.map((item) => ({
					job_id: item.job_id,
					document_id: item.document_id,
					filename: item.filename ?? "(unknown)",
					model: item.model,
					// `submitted_at` is a client-clock value; reconstruct
					// from the server's `created_at` so the panel duration
					// math has a stable origin for hydrated rows.
					submitted_at: item.created_at
						? new Date(item.created_at).getTime()
						: Date.now(),
					dedup_status: item.status,
					deduped: false,
				}));
			setJobs(seeded);
			setHydrated(true);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const onJobSubmitted = useCallback((job: SubmittedJob) => {
		// A re-submission of a previously-dismissed job should resurface
		// it. Drop the id from the dismissed set so future hydrations
		// don't filter it out either.
		setDismissed((prev) => {
			if (!prev.has(job.job_id)) return prev;
			const next = new Set(prev);
			next.delete(job.job_id);
			saveDismissed(next);
			return next;
		});
		setJobs((prev) => {
			const idx = prev.findIndex((j) => j.job_id === job.job_id);
			if (idx >= 0) {
				const next = [...prev];
				next[idx] = { ...prev[idx]!, ...job };
				return next;
			}
			return [job, ...prev];
		});
	}, []);

	const onRemove = useCallback((jobId: string) => {
		setJobs((prev) => prev.filter((j) => j.job_id !== jobId));
		setDismissed((prev) => {
			const next = new Set(prev);
			next.add(jobId);
			saveDismissed(next);
			return next;
		});
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<UploadDropzone onJobSubmitted={onJobSubmitted} />
			<JobsPanel jobs={jobs} onRemove={onRemove} hydrated={hydrated} />
		</div>
	);
}
