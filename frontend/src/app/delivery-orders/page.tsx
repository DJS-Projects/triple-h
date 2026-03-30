"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { DeliveryOrderResult } from "@/components/results/delivery-order-result";
import { ProcessingMetrics } from "@/components/results/processing-metrics";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { uploadPdf } from "@/lib/api";
import type { DeliveryOrderData, UploadSuccessResponse } from "@/lib/types";

export default function DeliveryOrdersPage() {
	const [file, setFile] = useState<File | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<UploadSuccessResponse | null>(null);

	const handleUpload = async () => {
		if (!file) return;
		setLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await uploadPdf(file);
			if (response.status === "ok") {
				setResult(response);
			} else {
				setError(response.message);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Delivery Orders</h1>
				<p className="text-sm text-gray-500">
					Upload a delivery order PDF to extract structured data.
				</p>
			</div>

			{/* Upload section */}
			<div className="rounded-xl border bg-white p-6 shadow-sm">
				<FileDropzone
					file={file}
					onFileSelect={setFile}
					onClear={() => {
						setFile(null);
						setResult(null);
						setError(null);
					}}
					disabled={loading}
				/>
				<button
					type="button"
					onClick={handleUpload}
					disabled={!file || loading}
					className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
				>
					{loading && <Loader2 className="h-4 w-4 animate-spin" />}
					{loading ? "Processing..." : "Upload & Process"}
				</button>
			</div>

			{/* Error */}
			{error && (
				<div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
					<AlertCircle className="mt-0.5 h-5 w-5 text-red-500" />
					<p className="text-sm text-red-700">{error}</p>
				</div>
			)}

			{/* Result */}
			{result && (
				<div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
					<div className="flex items-center gap-2 text-green-600">
						<CheckCircle2 className="h-5 w-5" />
						<span className="text-sm font-medium">Extraction complete</span>
					</div>
					<ProcessingMetrics data={result} />
					<DeliveryOrderResult data={result.parsed_info as DeliveryOrderData} />
				</div>
			)}
		</div>
	);
}
