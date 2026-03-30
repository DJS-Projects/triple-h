import type { UploadSuccessResponse } from "@/lib/types";

interface ProcessingMetricsProps {
	data: UploadSuccessResponse;
}

export function ProcessingMetrics({ data }: ProcessingMetricsProps) {
	return (
		<div className="grid grid-cols-2 gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-4">
			<Metric label="AI Model" value={data.model_used} />
			<Metric label="OCR Engine" value={data.ocr_model_name} />
			<Metric label="Processing Time" value={`${data.processing_time.toFixed(1)}s`} />
			<Metric
				label="Tokens"
				value={`${data.token_usage.input_tokens} in / ${data.token_usage.output_tokens} out`}
			/>
		</div>
	);
}

function Metric({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-gray-500">{label}</p>
			<p className="text-sm font-medium">{value}</p>
		</div>
	);
}
