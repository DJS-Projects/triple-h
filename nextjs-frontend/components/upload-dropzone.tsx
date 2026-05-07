"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { uploadAndExtract } from "@/lib/api";
import { DOC_TYPE_LABELS, DOC_TYPES, uploadSchema } from "@/lib/definitions";

type Status = "idle" | "selected" | "uploading" | "error";

export function UploadDropzone() {
	const router = useRouter();
	const inputRef = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [docType, setDocType] = useState<string>("");
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	const pickFile = useCallback((next: File | null) => {
		if (!next) {
			setFile(null);
			setStatus("idle");
			return;
		}
		const parsed = uploadSchema.safeParse({ file: next, doc_type: "" });
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			const msg: string = issue ? issue.message : "invalid file";
			setError(msg);
			setStatus("error");
			return;
		}
		setError(null);
		setFile(next);
		setStatus("selected");
	}, []);

	const submit = useCallback(async () => {
		if (!file) return;
		setStatus("uploading");
		setError(null);

		const fd = new FormData();
		fd.append("file", file);
		fd.append("doc_type", docType);

		const result = await uploadAndExtract(fd);
		if ("error" in result) {
			setError(result.error);
			setStatus("error");
			return;
		}
		router.push(`/documents/${result.documentId}`);
	}, [file, docType, router]);

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			setDragOver(false);
			const next = e.dataTransfer.files?.[0] ?? null;
			pickFile(next);
		},
		[pickFile],
	);

	return (
		<div className="flex flex-col gap-4">
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setDragOver(true);
				}}
				onDragLeave={() => setDragOver(false)}
				onDrop={onDrop}
				onClick={() => inputRef.current?.click()}
				onKeyDown={(e) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						inputRef.current?.click();
					}
				}}
				role="button"
				tabIndex={0}
				className={`group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors ${
					dragOver
						? "border-foreground bg-muted/40"
						: "border-border hover:border-foreground/60 hover:bg-muted/30"
				}`}
			>
				<input
					ref={inputRef}
					type="file"
					accept="application/pdf,.pdf"
					className="hidden"
					onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
				/>
				{file ? (
					<>
						<p className="font-medium">{file.name}</p>
						<p className="font-mono text-xs text-muted-foreground">
							{(file.size / 1024).toFixed(1)} KB · click to replace
						</p>
					</>
				) : (
					<>
						<p className="font-medium">Drop PDF here or click to choose</p>
						<p className="font-mono text-xs text-muted-foreground">
							PDF only · auto-classifies document type
						</p>
					</>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">Doc type</span>
					<select
						value={docType}
						onChange={(e) => setDocType(e.target.value)}
						disabled={status === "uploading"}
						className="rounded-md border bg-background px-2 py-1 text-sm"
					>
						<option value="">Auto-classify</option>
						{DOC_TYPES.map((t) => (
							<option key={t} value={t}>
								{DOC_TYPE_LABELS[t]}
							</option>
						))}
					</select>
				</label>

				<Button
					onClick={submit}
					disabled={!file || status === "uploading"}
					className="ml-auto"
				>
					{status === "uploading" ? "Extracting…" : "Extract"}
				</Button>
			</div>

			{status === "uploading" ? (
				<p className="font-mono text-xs text-muted-foreground">
					Running Chandra OCR + LLM extraction. Typical: 8–25s. Hang tight.
				</p>
			) : null}

			{error ? (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
