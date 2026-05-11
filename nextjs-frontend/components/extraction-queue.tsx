"use client";

import { useCallback, useEffect, useState } from "react";
import { JobsPanel } from "@/components/jobs-panel";
import {
	type SubmittedJob,
	UploadDropzone,
} from "@/components/upload-dropzone";
import { fetchRecentJobs } from "@/lib/api";

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

	// On-mount hydration. Best-effort: if the listing call fails we just
	// start with an empty queue rather than blocking the dropzone.
	useEffect(() => {
		let cancelled = false;
		fetchRecentJobs().then((res) => {
			if (cancelled) return;
			if ("error" in res) {
				setHydrated(true);
				return;
			}
			const seeded: SubmittedJob[] = res.map((item) => ({
				job_id: item.job_id,
				document_id: item.document_id,
				filename: item.filename ?? "(unknown)",
				model: item.model,
				// `submitted_at` is a client-clock value; reconstruct from
				// the server's `created_at` so the panel duration math has
				// a stable origin even for hydrated rows.
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
	}, []);

	return (
		<div className="flex flex-col gap-6">
			<UploadDropzone onJobSubmitted={onJobSubmitted} />
			<JobsPanel jobs={jobs} onRemove={onRemove} hydrated={hydrated} />
		</div>
	);
}
