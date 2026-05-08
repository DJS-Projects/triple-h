"use server";

import { revalidatePath } from "next/cache";
import {
	documentsDeleteDocument,
	documentsDeleteFieldReview,
	documentsGetDocumentDetail,
	documentsListDocuments,
	documentsPatchExtraction,
	extractExtractDocumentStructured,
	extractListExtractionModels,
	extractReextractDocument,
	refineRefineExtraction,
} from "@/app/clientService";
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

export async function uploadAndExtract(
	formData: FormData,
): Promise<ActionError | { documentId: string }> {
	const file = formData.get("file");
	const docType = (formData.get("doc_type") as string | null) ?? "";
	const model = (formData.get("model") as string | null) ?? "";

	if (!(file instanceof File) || file.size === 0) {
		return { error: "missing file" } satisfies ActionError;
	}

	const { data, error } = await extractExtractDocumentStructured({
		body: {
			file,
			doc_type: docType,
			...(model ? { model } : {}),
		},
	});

	if (error || !data) {
		const detail =
			(error as { detail?: unknown } | undefined)?.detail ?? error;
		return {
			error:
				typeof detail === "string"
					? detail
					: JSON.stringify(detail ?? "extraction failed"),
		} satisfies ActionError;
	}

	return { documentId: data.document_id };
}

export async function fetchDocumentDetail(documentId: string) {
	const { data, error } = await documentsGetDocumentDetail({
		path: { document_id: documentId },
	});
	if (error || !data) {
		return {
			error:
				typeof error === "string" ? error : "failed to load document",
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
		const detail =
			(error as { detail?: unknown } | undefined)?.detail ?? error;
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
		const detail =
			(error as { detail?: unknown } | undefined)?.detail ?? error;
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
		const detail =
			(error as { detail?: unknown } | undefined)?.detail ?? error;
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
		const detail =
			(error as { detail?: unknown } | undefined)?.detail ?? error;
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
