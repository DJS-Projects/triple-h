"use client";

import { ChevronDown, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchExtractionModels, submitExtractionJob } from "@/lib/api";
import { DOC_TYPE_LABELS, DOC_TYPES, uploadSchema } from "@/lib/definitions";

// Two-stage flow:
//   1) drop → files land in `staged[]` only; nothing hits the backend yet
//   2) review batch defaults (doc_type, model) + per-file list
//   3) click "Submit N to queue" → server actions fire, jobs land in the
//      panel below via `onJobSubmitted`
//
// The intermediate staging card is the load-bearing UX guarantee that no
// accidental drag-drop fires the queue. Users can also drop more PDFs
// before clicking submit (they append to staged[]).
type Status = "idle" | "selected" | "submitting" | "error";

interface ExtractionModel {
	id: string;
	label: string;
	provider: string;
	supports_multi_image: boolean;
	is_default: boolean;
	note: string | null;
}

export interface SubmittedJob {
	job_id: string;
	document_id: string;
	filename: string;
	model: string;
	submitted_at: number;
	dedup_status: string;
	deduped: boolean;
}

interface UploadDropzoneProps {
	onJobSubmitted: (job: SubmittedJob) => void;
}

// Generate a v4-shaped UUID without crypto.randomUUID (Zen / older Firefox
// don't expose it). Backend treats this as an opaque string; format is for
// log readability only.
function generateIdemKey(): string {
	const bytes = new Uint8Array(16);
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		crypto.getRandomValues(bytes);
	} else {
		for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	bytes[6] = (bytes[6]! & 0x0f) | 0x40;
	bytes[8] = (bytes[8]! & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// Per-staged-file row. Owns its own object URL + expand state so toggling
// the preview on one row doesn't re-render every sibling. The object URL
// is created lazily on first expand to avoid memory cost for files the
// user dismisses without previewing, and is always revoked on unmount.
interface StagedFileRowProps {
	file: File;
	index: number;
	disabled: boolean;
	onRemove: (index: number) => void;
}

function StagedFileRow({ file, index, disabled, onRemove }: StagedFileRowProps) {
	const [expanded, setExpanded] = useState(false);

	// Build the object URL only when the row is first expanded; revoke on
	// unmount or when the file changes (e.g. removed from staged list).
	const objectURL = useMemo(() => {
		if (!expanded) return null;
		return URL.createObjectURL(file);
	}, [expanded, file]);

	useEffect(() => {
		return () => {
			if (objectURL) URL.revokeObjectURL(objectURL);
		};
	}, [objectURL]);

	return (
		<li className="flex flex-col">
			<div className="flex items-center gap-3 px-3 py-2">
				<button
					type="button"
					onClick={() => setExpanded((e) => !e)}
					aria-expanded={expanded}
					aria-label={expanded ? "hide preview" : "show preview"}
					className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground"
				>
					{expanded ? (
						<ChevronDown className="h-3.5 w-3.5" />
					) : (
						<ChevronRight className="h-3.5 w-3.5" />
					)}
				</button>
				<button
					type="button"
					onClick={() => setExpanded((e) => !e)}
					className="min-w-0 flex-1 truncate text-left text-sm hover:underline"
				>
					{file.name}
				</button>
				<span className="shrink-0 font-mono text-[11px] text-muted-foreground">
					{formatBytes(file.size)}
				</span>
				<button
					type="button"
					onClick={() => onRemove(index)}
					disabled={disabled}
					aria-label={`remove ${file.name}`}
					className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
				>
					<Trash2 className="h-3.5 w-3.5" />
				</button>
			</div>
			{expanded && objectURL ? (
				<div className="border-t bg-muted/30 px-3 py-3">
					{/* <embed> falls back to the browser's built-in PDF viewer
					    (pdf.js in Firefox/Zen, native in Chrome/Safari). Fixed
					    height keeps the staging card compact; users scroll
					    inside the embed if they need more. */}
					<embed
						src={objectURL}
						type="application/pdf"
						className="block w-full rounded border bg-background"
						style={{ height: 480 }}
					/>
				</div>
			) : null}
		</li>
	);
}

export function UploadDropzone({ onJobSubmitted }: UploadDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [staged, setStaged] = useState<File[]>([]);
	const [docType, setDocType] = useState<string>("");
	const [model, setModel] = useState<string>("");
	const [models, setModels] = useState<ExtractionModel[]>([]);
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	const [dragOver, setDragOver] = useState(false);

	useEffect(() => {
		let cancelled = false;
		fetchExtractionModels().then((res) => {
			if (cancelled) return;
			if ("error" in res) return;
			const list = res as ExtractionModel[];
			setModels(list);
			const defaultModel = list.find((m) => m.is_default);
			if (defaultModel) setModel(defaultModel.id);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const stageFiles = useCallback((incoming: File[]) => {
		if (incoming.length === 0) return;
		const accepted: File[] = [];
		const rejected: string[] = [];
		for (const f of incoming) {
			const parsed = uploadSchema.safeParse({ file: f, doc_type: "" });
			if (parsed.success) accepted.push(f);
			else rejected.push(f.name);
		}
		if (accepted.length === 0) {
			setError(
				rejected.length > 0
					? `rejected: ${rejected.join(", ")}`
					: "no valid PDFs in selection",
			);
			setStatus("error");
			return;
		}
		setError(
			rejected.length > 0 ? `skipped: ${rejected.join(", ")}` : null,
		);
		setStaged((prev) => [...prev, ...accepted]);
		setStatus("selected");
	}, []);

	const removeFile = useCallback((idx: number) => {
		setStaged((prev) => prev.filter((_, i) => i !== idx));
	}, []);

	const clearAll = useCallback(() => {
		setStaged([]);
		setError(null);
		setStatus("idle");
	}, []);

	const submitAll = useCallback(async () => {
		if (staged.length === 0) return;
		setStatus("submitting");
		setError(null);

		// Submit sequentially — POSTs are cheap (~200ms each) but staying
		// sequential preserves a stable ordering in the queue panel and
		// keeps any per-submission error attributable to a single file.
		const remaining: File[] = [];
		const errors: string[] = [];
		for (const file of staged) {
			const fd = new FormData();
			fd.append("file", file);
			fd.append("doc_type", docType);
			if (model) fd.append("model", model);
			const idemKey = generateIdemKey();
			const result = await submitExtractionJob(fd, idemKey);
			if ("error" in result) {
				remaining.push(file);
				errors.push(`${file.name}: ${result.error}`);
				continue;
			}
			onJobSubmitted({
				job_id: result.job.job_id,
				document_id: result.job.document_id,
				filename: file.name,
				model: model || "default",
				submitted_at: Date.now(),
				dedup_status: result.job.status,
				deduped: result.job.deduped,
			});
		}
		setStaged(remaining);
		if (errors.length > 0) {
			setError(errors.join("\n"));
			setStatus("error");
		} else {
			setStatus("idle");
		}
	}, [staged, docType, model, onJobSubmitted]);

	const onDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			setDragOver(false);
			const dropped = Array.from(e.dataTransfer.files ?? []);
			stageFiles(dropped);
		},
		[stageFiles],
	);

	const busy = status === "submitting";
	const totalBytes = staged.reduce((sum, f) => sum + f.size, 0);
	const selectedModelLabel =
		models.find((m) => m.id === model)?.label ?? model ?? "default";
	const docTypeDisplay = docType
		? DOC_TYPE_LABELS[docType as (typeof DOC_TYPES)[number]]
		: "Auto-classify";

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
					multiple
					className="hidden"
					onChange={(e) =>
						stageFiles(Array.from(e.target.files ?? []))
					}
				/>
				<p className="font-medium">
					Drop PDFs here or click to choose (multiple allowed)
				</p>
				<p className="font-mono text-xs text-muted-foreground">
					Staged for review before queueing · no jobs fire until you click Submit
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<label className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">Doc type</span>
					<select
						value={docType}
						onChange={(e) => setDocType(e.target.value)}
						disabled={busy}
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

				<label className="flex items-center gap-2 text-sm">
					<span className="text-muted-foreground">Model</span>
					<select
						value={model}
						onChange={(e) => setModel(e.target.value)}
						disabled={busy || models.length === 0}
						className="rounded-md border bg-background px-2 py-1 text-sm"
					>
						{models.length === 0 ? (
							<option value="">Loading…</option>
						) : (
							models.map((m) => (
								<option key={m.id} value={m.id}>
									{m.label} · {m.provider}
									{!m.supports_multi_image ? " · 1 page only" : ""}
								</option>
							))
						)}
					</select>
				</label>
			</div>

			{model ? (
				(() => {
					const sel = models.find((m) => m.id === model);
					return sel?.note ? (
						<p className="font-mono text-[11px] text-muted-foreground">
							{sel.note}
						</p>
					) : null;
				})()
			) : null}

			{staged.length > 0 ? (
				<>
					<div className="flex flex-col gap-1">
						<h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-brand-blue">
							Staged for queue
						</h3>
						<p className="font-mono text-[11px] text-muted-foreground">
							{staged.length} file{staged.length === 1 ? "" : "s"} ·{" "}
							{formatBytes(totalBytes)} · batch defaults:{" "}
							<span className="text-foreground">{docTypeDisplay}</span> ·{" "}
							<span className="text-foreground">{selectedModelLabel}</span>
						</p>
					</div>

					<ul className="flex w-full flex-col divide-y border-y">
						{staged.map((f, i) => (
							<StagedFileRow
								key={`${f.name}-${f.size}-${f.lastModified}-${i}`}
								file={f}
								index={i}
								disabled={busy}
								onRemove={removeFile}
							/>
						))}
					</ul>

					<div className="flex items-center justify-between gap-3">
						<Button
							variant="outline"
							onClick={clearAll}
							disabled={busy}
							className="text-sm"
						>
							Clear all
						</Button>
						<Button
							onClick={submitAll}
							disabled={busy || staged.length === 0}
							className="text-sm"
						>
							{busy ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Submitting {staged.length}
								</>
							) : staged.length === 1 ? (
								"Submit to queue"
							) : (
								`Submit ${staged.length} to queue`
							)}
						</Button>
					</div>
				</>
			) : null}

			{error ? (
				<p className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
