"use client";

import { CLOUD_MODELS, LOCAL_MODELS, OCR_MODELS } from "@/lib/constants";
import type { OcrModel, Provider } from "@/lib/types";

interface ModelSelectorProps {
	provider: Provider;
	model: string;
	ocrModel: OcrModel;
	confidenceScore: number;
	onProviderChange: (p: Provider) => void;
	onModelChange: (m: string) => void;
	onOcrModelChange: (m: OcrModel) => void;
	onConfidenceChange: (c: number) => void;
	disabled?: boolean;
}

export function ModelSelector({
	provider,
	model,
	ocrModel,
	confidenceScore,
	onProviderChange,
	onModelChange,
	onOcrModelChange,
	onConfidenceChange,
	disabled = false,
}: ModelSelectorProps) {
	const models = provider === "local" ? LOCAL_MODELS : CLOUD_MODELS;

	return (
		<div className="grid gap-4 sm:grid-cols-2">
			{/* Provider */}
			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-700">AI Provider</span>
				<select
					value={provider}
					onChange={(e) => {
						const p = e.target.value as Provider;
						onProviderChange(p);
						const defaults = p === "local" ? LOCAL_MODELS : CLOUD_MODELS;
						onModelChange(defaults[0].value);
					}}
					disabled={disabled}
					className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
				>
					<option value="cloud">Cloud (Google AI)</option>
					<option value="local">Local (Ollama)</option>
				</select>
			</label>

			{/* Model */}
			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-700">Model</span>
				<select
					value={model}
					onChange={(e) => onModelChange(e.target.value)}
					disabled={disabled}
					className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
				>
					{models.map((m) => (
						<option key={m.value} value={m.value}>
							{m.label}
						</option>
					))}
				</select>
			</label>

			{/* OCR Model */}
			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-700">OCR Engine</span>
				<select
					value={ocrModel}
					onChange={(e) => onOcrModelChange(e.target.value as OcrModel)}
					disabled={disabled}
					className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
				>
					{OCR_MODELS.map((m) => (
						<option key={m.value} value={m.value}>
							{m.label} — {m.description}
						</option>
					))}
				</select>
			</label>

			{/* Confidence */}
			<label className="block">
				<span className="mb-1 block text-sm font-medium text-gray-700">
					Handwriting Confidence: {confidenceScore}%
				</span>
				<input
					type="range"
					min={1}
					max={100}
					value={confidenceScore}
					onChange={(e) => onConfidenceChange(Number(e.target.value))}
					disabled={disabled}
					className="w-full"
				/>
			</label>
		</div>
	);
}
