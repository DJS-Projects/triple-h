"use server";

import { revalidatePath } from "next/cache";
import {
	documentsGetDocumentDetail,
	documentsListDocuments,
	documentsPatchExtraction,
	extractExtractDocumentStructured,
	refineRefineExtraction,
} from "@/app/clientService";
import type { FieldEditInput } from "@/lib/definitions";

export type ActionError = { error: string };

export async function uploadAndExtract(
	formData: FormData,
): Promise<ActionError | { documentId: string }> {
	const file = formData.get("file");
	const docType = (formData.get("doc_type") as string | null) ?? "";

	if (!(file instanceof File) || file.size === 0) {
		return { error: "missing file" } satisfies ActionError;
	}

	const { data, error } = await extractExtractDocumentStructured({
		body: {
			file,
			doc_type: docType,
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
