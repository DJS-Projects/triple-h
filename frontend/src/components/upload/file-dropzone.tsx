"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";

interface FileDropzoneProps {
	onFileSelect: (file: File) => void;
	file: File | null;
	onClear: () => void;
	disabled?: boolean;
	accept?: string;
}

export function FileDropzone({
	onFileSelect,
	file,
	onClear,
	disabled = false,
	accept = ".pdf",
}: FileDropzoneProps) {
	const [dragOver, setDragOver] = useState(false);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setDragOver(false);
			if (disabled) return;
			const dropped = e.dataTransfer.files[0];
			if (dropped?.type === "application/pdf") {
				onFileSelect(dropped);
			}
		},
		[disabled, onFileSelect],
	);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selected = e.target.files?.[0];
		if (selected) onFileSelect(selected);
	};

	if (file) {
		return (
			<div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4">
				<div className="flex items-center gap-3">
					<FileText className="h-5 w-5 text-blue-600" />
					<div>
						<p className="text-sm font-medium">{file.name}</p>
						<p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
					</div>
				</div>
				<button
					type="button"
					onClick={onClear}
					disabled={disabled}
					className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
				>
					<X className="h-4 w-4" />
				</button>
			</div>
		);
	}

	return (
		<label
			onDrop={handleDrop}
			onDragOver={(e) => {
				e.preventDefault();
				setDragOver(true);
			}}
			onDragLeave={() => setDragOver(false)}
			className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition ${
				dragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
			} ${disabled ? "pointer-events-none opacity-50" : ""}`}
		>
			<Upload className="mb-3 h-8 w-8 text-gray-400" />
			<span className="mb-1 text-sm font-medium text-gray-600">
				Drop a PDF here or click to browse
			</span>
			<span className="text-xs text-gray-400">PDF files only, up to 50 MB</span>
			<input
				type="file"
				accept={accept}
				onChange={handleChange}
				disabled={disabled}
				className="sr-only"
			/>
		</label>
	);
}
