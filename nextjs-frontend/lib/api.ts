"use server";

import { revalidatePath } from "next/cache";
import {
	documentsDeleteDocument,
	documentsDeleteFieldReview,
	documentsGetDocumentDetail,
	documentsListDocuments,
	documentsPatchExtraction,
	extractListExtractionModels,
	extractReextractDocument,
	jobsListJobs,
	jobsSubmitExtractionJob,
	refineRefineExtraction,
} from "@/app/clientService";
import type {
	JobListItem,
	JobStatusResponse,
	SubmitJobResponse,
} from "@/app/openapi-client/types.gen";
import type { FieldEditInput } from "@/lib/definitions";

export type ActionError = { error: string };

export async function fetchExtractionModels() {
	const { data, error } = await extractListExtractionModels();
	if (error || !data) {
		return {
			error: typeof error === "string" ? error : "failed to load models",
		} satisfies ActionError;
	}
	return data;
}

// Hand-typed because the openapi-client hasn't been regenerated yet —
// swap to extractGetExtractionFeatureFlags() after the next
// `bun run generate-client` and this can collapse to the same shape as
// fetchExtractionModels above. Raw fetch follows the same pattern as
// fetchJobStatus / cancelJob below for endpoints not yet in the
// generated SDK.
export type ExtractionFeatureFlags = { use_arq_pipeline: boolean };

export async function fetchExtractionFeatureFlags(): Promise<
	ActionError | ExtractionFeatureFlags
> {
	const res = await fetch(`${process.env.API_BASE_URL}/extract/feature-flags`, {
		cache: "no-store",
	});
	if (!res.ok) {
		return { error: `flags fetch ${res.status}` } satisfies ActionError;
	}
	return (await res.json()) as ExtractionFeatureFlags;
}

// ─── Async job queue (T17) ──────────────────────────────────────────────────
//
// `submitExtractionJob` is the queue-aware sibling of `uploadAndExtract`. It
// hits POST /extract/jobs which returns a 202 immediately with a job_id; the
// caller then opens an SSE stream (via the /api/jobs/[id]/stream proxy) to
// watch real pipeline stages instead of fake elapsed-time labels.
//
// Idempotency-Key is a per-submission UUID generated client-side. Same key
// + identical content within the active window returns the same job_id
// (deduped=true) so accidental double-clicks don't queue twice.

export type SubmitJobResult = ActionError | { job: SubmitJobResponse };

export async function submitExtractionJob(
	formData: FormData,
	idempotencyKey: string,
): Promise<SubmitJobResult> {
	const file = formData.get("file");
	const docType = (formData.get("doc_type") as string | null) ?? "";
	const model = (formData.get("model") as string | null) ?? "";
	// Only forward pipeline_mode when the caller explicitly set it.
	// Omitting the field defers to the server-side GrowthBook flag, which
	// is the desired default ("auto" in the FE selector maps to this).
	const pipelineMode = (formData.get("pipeline_mode") as string | null) ?? "";

	if (!(file instanceof File) || file.size === 0) {
		return { error: "missing file" } satisfies ActionError;
	}

	const { data, error } = await jobsSubmitExtractionJob({
		headers: { "Idempotency-Key": idempotencyKey },
		body: {
			file,
			doc_type: docType,
			...(model ? { model } : {}),
			...(pipelineMode ? { pipeline_mode: pipelineMode } : {}),
		},
	});

	if (error || !data) {
		const detail = (error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "submit failed"),
		} satisfies ActionError;
	}
	return { job: data };
}

export type JobSnapshotResult = ActionError | JobStatusResponse;

// One-shot poll fallback for clients that can't use SSE (or for the final
// fetch after stream close to confirm terminal state).
export async function fetchJobStatus(
	jobId: string,
): Promise<JobSnapshotResult> {
	const res = await fetch(`${process.env.API_BASE_URL}/jobs/${jobId}`, {
		cache: "no-store",
	});
	if (!res.ok) {
		return { error: `job fetch ${res.status}` } satisfies ActionError;
	}
	return (await res.json()) as JobStatusResponse;
}

export type JobListResult = ActionError | JobListItem[];

// Hydrate the FE queue panel across page refreshes. Filters by status so
// the panel doesn't re-show every historical job — defaults to the active
// + recently-terminal slice, which is what users actually want to see.
export async function fetchRecentJobs(
	statuses: Array<"pending" | "running" | "succeeded" | "failed"> = [
		"pending",
		"running",
		"succeeded",
		"failed",
	],
	limit: number = 50,
): Promise<JobListResult> {
	const { data, error } = await jobsListJobs({
		query: { statuses: statuses.join(","), limit },
	});
	if (error || !data) {
		return {
			error: typeof error === "string" ? error : "failed to list jobs",
		} satisfies ActionError;
	}
	return data;
}

// Cancel a queued/running job. Backend flip is idempotent — calling on an
// already-terminal job is a no-op that returns the current snapshot, so the
// FE button doesn't need to debounce double-clicks.
export async function cancelJob(jobId: string): Promise<JobSnapshotResult> {
	const res = await fetch(`${process.env.API_BASE_URL}/jobs/${jobId}/cancel`, {
		method: "POST",
		cache: "no-store",
	});
	if (!res.ok) {
		return { error: `cancel ${res.status}` } satisfies ActionError;
	}
	return (await res.json()) as JobStatusResponse;
}

export async function fetchDocumentDetail(documentId: string) {
	const { data, error } = await documentsGetDocumentDetail({
		path: { document_id: documentId },
	});
	if (error || !data) {
		return {
			error: typeof error === "string" ? error : "failed to load document",
		} satisfies ActionError;
	}
	return data;
}

export async function fetchDocumentList(page = 1, size = 20) {
	const { data, error } = await documentsListDocuments({
		query: { page, size },
	});
	if (error || !data) {
		return {
			error: typeof error === "string" ? error : "failed to list documents",
		} satisfies ActionError;
	}
	return data;
}

export async function saveFieldEdits(
	documentId: string,
	edits: FieldEditInput[],
) {
	if (edits.length === 0) return { error: "no edits" } satisfies ActionError;

	const { data, error } = await documentsPatchExtraction({
		path: { document_id: documentId },
		body: { edits },
	});

	if (error || !data) {
		const detail = (error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "patch failed"),
		} satisfies ActionError;
	}

	revalidatePath(`/documents/${documentId}`);
	return data;
}

export async function reextractDocument(
	documentId: string,
	opts: { model?: string; doc_type?: string } = {},
) {
	const { data, error } = await extractReextractDocument({
		path: { document_id: documentId },
		body: {
			...(opts.model ? { model: opts.model } : {}),
			...(opts.doc_type ? { doc_type: opts.doc_type as never } : {}),
		},
	});
	if (error || !data) {
		const detail = (error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "reextract failed"),
		} satisfies ActionError;
	}
	revalidatePath(`/documents/${documentId}`);
	return data;
}

export async function deleteDocument(
	documentId: string,
): Promise<ActionError | { ok: true }> {
	const { error } = await documentsDeleteDocument({
		path: { document_id: documentId },
	});
	if (error) {
		const detail = (error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "delete failed"),
		};
	}
	revalidatePath("/documents");
	return { ok: true };
}

export async function deleteFieldReview(
	documentId: string,
	reviewId: number,
): Promise<ActionError | { ok: true }> {
	const { error } = await documentsDeleteFieldReview({
		path: { document_id: documentId, review_id: reviewId },
	});
	if (error) {
		const detail = (error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "delete failed"),
		};
	}
	revalidatePath(`/documents/${documentId}`);
	return { ok: true };
}

export async function refineExtraction(extractionRunId: number) {
	const { data, error } = await refineRefineExtraction({
		path: { extraction_run_id: extractionRunId },
	});
	if (error || !data) {
		return {
			error: typeof error === "string" ? error : "refine failed",
		} satisfies ActionError;
	}
	return data;
}
