import axios from "axios";
import { DEFAULT_CLOUD_MODEL, DEFAULT_OCR_MODEL } from "./constants";
import type { UploadOptions, UploadResponse } from "./types";

const client = axios.create({
	timeout: 600_000, // 10 minutes — OCR on large PDFs is slow
});

/**
 * Upload a PDF to the BFF route, which proxies to the doc_extractor backend.
 */
export async function uploadPdf(file: File, options: UploadOptions = {}): Promise<UploadResponse> {
	const form = new FormData();
	form.append("file", file);
	form.append("provider", options.provider ?? "cloud");
	form.append("model", options.model ?? DEFAULT_CLOUD_MODEL);
	form.append("ocr_model", options.ocrModel ?? DEFAULT_OCR_MODEL);
	form.append("confidence_score", String(options.confidenceScore ?? 90));

	const { data } = await client.post<UploadResponse>("/api/upload", form);
	return data;
}
