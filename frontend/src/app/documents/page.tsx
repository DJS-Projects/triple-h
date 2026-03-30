"use client";

import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { DeliveryOrderResult } from "@/components/results/delivery-order-result";
import { InvoiceResult } from "@/components/results/invoice-result";
import { ProcessingMetrics } from "@/components/results/processing-metrics";
import { WeighingBillResult } from "@/components/results/weighing-bill-result";
import { FileDropzone } from "@/components/upload/file-dropzone";
import { ModelSelector } from "@/components/upload/model-selector";
import { uploadPdf } from "@/lib/api";
import type { MixedParsedInfo, OcrModel, Provider, UploadSuccessResponse } from "@/lib/types";

export default function DocumentsPage() {
	const [file, setFile] = useState<File | null>(null);
	const [provider, setProvider] = useState<Provider>("cloud");
	const [model, setModel] = useState("gemini-2.0-flash");
	const [ocrModel, setOcrModel] = useState<OcrModel>("2");
	const [confidenceScore, setConfidenceScore] = useState(90);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [result, setResult] = useState<UploadSuccessResponse | null>(null);

	const handleUpload = async () => {
		if (!file) return;
		setLoading(true);
		setError(null);
		setResult(null);

		try {
			const response = await uploadPdf(file, {
				provider,
				model,
				ocrModel,
				confidenceScore,
			});
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

	const parsed = result?.parsed_info as MixedParsedInfo | undefined;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold">Mixed Documents</h1>
				<p className="text-sm text-gray-500">
					Upload PDFs containing delivery orders, invoices, or weighing bills. Choose your AI
					provider and OCR engine.
				</p>
			</div>

			{/* Upload + Settings */}
			<div className="space-y-4 rounded-xl border bg-white p-6 shadow-sm">
				<ModelSelector
					provider={provider}
					model={model}
					ocrModel={ocrModel}
					confidenceScore={confidenceScore}
					onProviderChange={setProvider}
					onModelChange={setModel}
					onOcrModelChange={setOcrModel}
					onConfidenceChange={setConfidenceScore}
					disabled={loading}
				/>

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
					className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
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

			{/* Results */}
			{result && parsed && (
				<div className="space-y-6 rounded-xl border bg-white p-6 shadow-sm">
					<div className="flex items-center gap-2 text-green-600">
						<CheckCircle2 className="h-5 w-5" />
						<span className="text-sm font-medium">Extraction complete</span>
						<div className="ml-auto flex gap-2">
							{result.document_analysis.detected_types.map((type) => (
								<span
									key={type}
									className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700"
								>
									{type.replace(/_/g, " ")}
								</span>
							))}
						</div>
					</div>

					<ProcessingMetrics data={result} />

					{parsed.delivery_order_data && <DeliveryOrderResult data={parsed.delivery_order_data} />}
					{parsed.weighing_bill_data && <WeighingBillResult data={parsed.weighing_bill_data} />}
					{parsed.invoice_data && <InvoiceResult data={parsed.invoice_data} />}
				</div>
			)}
		</div>
	);
}
