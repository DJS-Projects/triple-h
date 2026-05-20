"use client";

import {
	ChevronDown,
	ChevronRight,
	Info,
	Loader2,
	Plus,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	fetchExtractionFeatureFlags,
	fetchExtractionModels,
	submitExtractionJob,
} from "@/lib/api";
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
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
		"",
	);
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

function StagedFileRow({
	file,
	index,
	disabled,
	onRemove,
}: StagedFileRowProps) {
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
	// Pipeline mode override. "auto" defers to the backend's GrowthBook
	// flag (use_arq_pipeline). Explicit picks ("arq" / "single_pass") get
	// stamped onto request_meta and force the worker's variant for this
	// batch only — no global flag mutation.
	const [pipelineMode, setPipelineMode] = useState<
		"auto" | "arq" | "single_pass"
	>("auto");
	// ARQ is gated by the GrowthBook flag `use_arq_pipeline`. When the
	// flag is off, the pipeline-mode selector is hidden entirely — there
	// is no per-batch override available and submissions take the single-
	// pass path. When the flag is on, the selector becomes a per-batch
	// opt-out from ARQ. Defaults to false so a flag-server outage just
	// keeps the experimental UI hidden (matches the backend's safe-default
	// fallback in `is_feature_on`).
	const [arqEnabled, setArqEnabled] = useState(false);
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);
	// Already-extracted files from the most recent submit batch. Surfaced as
	// an inline notice with links to /documents/{id} so users see WHICH files
	// were skipped without those rows cluttering the live queue panel.
	const [alreadyExtracted, setAlreadyExtracted] = useState<
		{ document_id: string; filename: string }[]
	>([]);
	const [dragOver, setDragOver] = useState(false);
	// Track which model notes the user has dismissed within this session.
	// Keyed by model id so switching models re-shows the new model's note,
	// while keeping the previously-dismissed one dismissed if they switch
	// back. State only — no persistence across reloads (notes are short
	// and the dismiss is cosmetic).
	const [dismissedNotes, setDismissedNotes] = useState<Set<string>>(
		() => new Set(),
	);

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
		// Flag fetch is independent of model fetch — separate Promise so a
		// failure on one doesn't suppress the other. On error we leave
		// arqEnabled at its default `false`, which hides the selector
		// (safe default — matches `is_feature_on`'s server-side fallback).
		fetchExtractionFeatureFlags().then((res) => {
			if (cancelled) return;
			if ("error" in res) return;
			setArqEnabled(res.use_arq_pipeline);
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
		setError(rejected.length > 0 ? `skipped: ${rejected.join(", ")}` : null);
		setAlreadyExtracted([]);
		setStaged((prev) => [...prev, ...accepted]);
		setStatus("selected");
	}, []);

	const removeFile = useCallback((idx: number) => {
		setStaged((prev) => prev.filter((_, i) => i !== idx));
	}, []);

	const clearAll = useCallback(() => {
		setStaged([]);
		setError(null);
		setAlreadyExtracted([]);
		setStatus("idle");
	}, []);

	const submitAll = useCallback(async () => {
		if (staged.length === 0) return;
		setStatus("submitting");
		setError(null);
		setAlreadyExtracted([]);

		// Submit sequentially — POSTs are cheap (~200ms each) but staying
		// sequential preserves a stable ordering in the queue panel and
		// keeps any per-submission error attributable to a single file.
		const remaining: File[] = [];
		const errors: string[] = [];
		const extractedNow: { document_id: string; filename: string }[] = [];
		for (const file of staged) {
			const fd = new FormData();
			fd.append("file", file);
			fd.append("doc_type", docType);
			if (model) fd.append("model", model);
			// Only send pipeline_mode when ARQ is actually enabled (the
			// selector is visible) AND the user picked an explicit variant.
			// "auto" or a hidden selector → omit so the backend falls
			// through to the GrowthBook flag default.
			if (arqEnabled && pipelineMode !== "auto") {
				fd.append("pipeline_mode", pipelineMode);
			}
			const idemKey = generateIdemKey();
			const result = await submitExtractionJob(fd, idemKey);
			if ("error" in result) {
				remaining.push(file);
				errors.push(`${file.name}: ${result.error}`);
				continue;
			}
			// Already-extracted short-circuit: skip queue insertion and
			// collect for the inline notice. The queue panel should only
			// carry rows that have work in flight; deduped-succeeded
			// uploads are immediately available via /documents/{id}, so a
			// row going pending→running→succeeded would be misleading.
			// In-flight dedupes (status pending/running) and dedupes onto
			// failed jobs still flow into the queue so the user keeps
			// visibility on the existing work.
			if (result.job.deduped && result.job.status === "succeeded") {
				extractedNow.push({
					document_id: result.job.document_id,
					filename: file.name,
				});
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
		if (extractedNow.length > 0) {
			setAlreadyExtracted(extractedNow);
		}
		if (errors.length > 0) {
			setError(errors.join("\n"));
			setStatus("error");
		} else {
			setStatus("idle");
		}
	}, [staged, docType, model, pipelineMode, arqEnabled, onJobSubmitted]);

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
	const pipelineModeDisplay =
		pipelineMode === "auto"
			? "Auto pipeline"
			: pipelineMode === "arq"
				? "ARQ pipeline"
				: "Single-pass pipeline";

	const openFilePicker = () => inputRef.current?.click();

	// Shared drag-event handlers — both the empty-state dashed card and
	// the staged-table card mount these so the user can drop files into
	// either surface.
	const dragHandlers = {
		onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
			e.preventDefault();
			setDragOver(true);
		},
		onDragLeave: () => setDragOver(false),
		onDrop,
	};

	return (
		<div className="flex flex-col gap-4">
			{/* The file input lives outside the conditional so both states
			    (empty dashed card + staged table's "Add more files" button)
			    can trigger the same picker without duplicating the element
			    or losing the ref on transition. */}
			<input
				ref={inputRef}
				type="file"
				accept="application/pdf,.pdf"
				multiple
				className="hidden"
				onChange={(e) => stageFiles(Array.from(e.target.files ?? []))}
			/>

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

				{arqEnabled ? (
					<label className="flex items-center gap-2 text-sm">
						<span className="text-muted-foreground">Pipeline</span>
						<select
							value={pipelineMode}
							onChange={(e) =>
								setPipelineMode(
									e.target.value as "auto" | "arq" | "single_pass",
								)
							}
							disabled={busy}
							className="rounded-md border bg-background px-2 py-1 text-sm"
						>
							<option value="auto">Auto (flag default)</option>
							<option value="arq">ARQ (anchored)</option>
							<option value="single_pass">Single-pass</option>
						</select>
					</label>
				) : null}

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

			{model
				? (() => {
						const sel = models.find((m) => m.id === model);
						if (!sel?.note) return null;
						if (dismissedNotes.has(sel.id)) return null;
						return (
							<div className="flex items-center gap-3 rounded-md border border-brand-blue/30 bg-brand-blue/5 py-2 pl-3 pr-2">
								{/* Icon column with vertical rule. self-stretch
								    lets the column take full row height so the
								    border-r renders as a divider regardless of
								    the text's wrap height. */}
								<div className="flex shrink-0 items-center self-stretch border-r border-brand-blue/30 pr-3">
									<Info className="h-3.5 w-3.5 text-brand-blue" />
								</div>
								<p className="flex-1 font-mono text-[11px] text-foreground/80">
									{sel.note}
								</p>
								<button
									type="button"
									onClick={() =>
										setDismissedNotes((prev) => {
											const next = new Set(prev);
											next.add(sel.id);
											return next;
										})
									}
									aria-label="dismiss note"
									className="flex shrink-0 items-center justify-center rounded p-0.5 text-muted-foreground hover:text-foreground"
								>
									<X className="h-3 w-3" />
								</button>
							</div>
						);
					})()
				: null}

			{/* Single drop-target container that morphs between empty and
			    staged states. Keeping one container means the drop zone
			    never moves on the page — first drop and subsequent drops
			    land in the same visual region. Empty = dashed border +
			    centered prompt + whole-region click. Staged = solid border
			    + header + table + add-more. Drag-over overlays both. */}
			<div
				{...dragHandlers}
				{...(staged.length === 0
					? {
							onClick: openFilePicker,
							onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									openFilePicker();
								}
							},
							role: "button" as const,
							tabIndex: 0,
						}
					: {})}
				className={`relative flex flex-col rounded-lg border-2 transition-colors ${
					staged.length === 0
						? `cursor-pointer items-center justify-center gap-3 border-dashed px-6 py-14 text-center ${
								dragOver
									? "border-foreground bg-muted/40"
									: "border-border hover:border-foreground/60 hover:bg-muted/30"
							}`
						: `gap-3 border-solid p-3 ${
								dragOver ? "border-foreground/60" : "border-border"
							}`
				}`}
			>
				{/* Drag overlay — pointer-events-none so drop events still
				    reach the container handler. Only shown in staged state;
				    empty state already signals drop-readiness through the
				    dashed border + hover styling. */}
				{dragOver && staged.length > 0 ? (
					<div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-foreground/40 bg-background/60 backdrop-blur-sm">
						<p className="font-display text-base font-semibold text-foreground">
							Drop PDFs to add to the queue
						</p>
						<p className="font-mono text-[11px] text-muted-foreground">
							Files append to the staged list — no jobs fire yet
						</p>
					</div>
				) : null}

				{staged.length === 0 ? (
					<>
						<p className="font-medium">
							Drop PDFs here or click to choose (multiple allowed)
						</p>
						<p className="font-mono text-xs text-muted-foreground">
							Staged for review before queueing · no jobs fire until you click
							Submit
						</p>
					</>
				) : (
					<>
						<div className="flex flex-col gap-1">
							<h3 className="font-display text-sm font-semibold uppercase tracking-[0.12em] text-brand-blue">
								Staged for queue
							</h3>
							<p className="font-mono text-[11px] text-muted-foreground">
								{staged.length} file{staged.length === 1 ? "" : "s"} ·{" "}
								{formatBytes(totalBytes)} · batch defaults:{" "}
								<span className="text-foreground">{docTypeDisplay}</span>
								{arqEnabled ? (
									<>
										{" · "}
										<span className="text-foreground">
											{pipelineModeDisplay}
										</span>
									</>
								) : null}
								{" · "}
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

						<button
							type="button"
							onClick={openFilePicker}
							disabled={busy}
							className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/60 hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
						>
							<Plus className="h-4 w-4" />
							Add more files
						</button>
					</>
				)}
			</div>

			{staged.length > 0 ? (
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={clearAll}
						disabled={busy}
					>
						Clear all
					</Button>
					<Button
						size="sm"
						onClick={submitAll}
						disabled={busy || staged.length === 0}
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
			) : null}

			{error ? (
				<p className="whitespace-pre-wrap rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}

			{alreadyExtracted.length > 0 ? (
				<div className="rounded-md border border-muted bg-muted/30 px-3 py-2 text-sm">
					<p className="font-medium text-muted-foreground">
						Already extracted — open existing result
						{alreadyExtracted.length > 1 ? "s" : ""}:
					</p>
					<ul className="mt-1 space-y-0.5">
						{alreadyExtracted.map((item) => (
							<li key={item.document_id}>
								<Link
									href={`/documents/${item.document_id}`}
									className="font-mono text-xs hover:underline"
								>
									{item.filename}
								</Link>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</div>
	);
}
