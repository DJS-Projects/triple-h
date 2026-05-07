"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
	PageOverlay,
	ScaleSlider,
	usePageBlocks,
} from "@/components/page-overlay";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { saveFieldEdits } from "@/lib/api";
import { DOC_TYPE_LABELS, type DocType } from "@/lib/definitions";
import {
	coerceEdited,
	type KvpRow,
	type LeafValue,
	splitExtraction,
	type TableSection,
} from "@/lib/kvp";

interface PageDims {
	page_no: number;
	width_px: number;
	height_px: number;
}

interface DocumentDetail {
	document: {
		document_id: string;
		filename: string;
		mime_type: string;
		size_bytes: number;
		page_count: number | null;
		doc_type: string | null;
		status: string;
		created_at: string;
	};
	page_count: number | null;
	pages: PageDims[];
	current_extraction: {
		extraction_run_id: number;
		doc_type: string;
		schema_version: string;
		llm_model: string;
		duration_ms: number;
		checkpoint_id: string | null;
		is_current: boolean;
		created_at: string;
		extracted_view: Record<string, unknown>;
		field_pages: Record<string, number>;
		reviews: Array<{
			field_path: string;
			edited_value: unknown;
			original_value: unknown;
			remark: string | null;
			created_at: string;
		}>;
	} | null;
}

export function ReviewClient({ detail }: { detail: DocumentDetail }) {
	const router = useRouter();
	const { document: doc, current_extraction: run } = detail;
	const [pageNo, setPageNo] = useState(1);
	const [draft, setDraft] = useState<Record<string, string>>({});
	const [remark, setRemark] = useState<Record<string, string>>({});
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [hoveredField, setHoveredField] = useState<string | null>(null);
	const [hoveredBlock, setHoveredBlock] = useState<string | null>(null);
	const [scale, setScale] = useState(1);

	const { data: pageBlocks } = usePageBlocks(doc.document_id, pageNo);

	// Bidirectional hover map: anchors[field_path] = block_id.
	const anchors = pageBlocks?.field_anchors ?? {};
	const blockToField = useMemo(() => {
		const out: Record<string, string> = {};
		for (const [path, bid] of Object.entries(anchors)) out[bid] = path;
		return out;
	}, [anchors]);

	// Block highlighted on the page = either directly hovered or
	// derived from the currently-hovered KVP row via the anchor map.
	const highlightedBlockId =
		hoveredBlock ?? (hoveredField ? anchors[hoveredField] ?? null : null);
	// And vice versa for the KVP side.
	const highlightedFieldPath =
		hoveredField ?? (hoveredBlock ? blockToField[hoveredBlock] ?? null : null);

	const split = useMemo(
		() =>
			run
				? splitExtraction(run.extracted_view)
				: { scalars: [], tables: [] },
		[run],
	);

	// Path A: split scalars into current-page vs doc-level using server-provided
	// field_pages. The BE flattens arrays with [i] indexing, but splitExtraction
	// unwraps len-1 arrays to bare keys — so probe both `path` and `path[0]`.
	const fieldPages = run?.field_pages ?? {};
	const pageForPath = (path: string): number | undefined =>
		fieldPages[path] ?? fieldPages[`${path}[0]`];

	const { pageScalars, docScalars } = useMemo(() => {
		const onPage: KvpRow[] = [];
		const docLevel: KvpRow[] = [];
		for (const row of split.scalars) {
			const p = pageForPath(row.path);
			if (p === pageNo) onPage.push(row);
			else if (p === undefined) docLevel.push(row);
			// rows anchored to a different page are hidden on this page
		}
		return { pageScalars: onPage, docScalars: docLevel };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [split.scalars, fieldPages, pageNo]);

	const dirty = Object.keys(draft).length > 0;

	const onSave = () => {
		if (!run) return;
		const edits = Object.entries(draft).map(([field_path, raw]) => {
			const original =
				split.scalars.find((r) => r.path === field_path)?.value ?? null;
			return {
				field_path,
				edited_value: coerceEdited(original, raw),
				remark: remark[field_path] || undefined,
			};
		});

		startTransition(async () => {
			const result = await saveFieldEdits(doc.document_id, edits);
			if ("error" in result) {
				setError(result.error);
				return;
			}
			setDraft({});
			setRemark({});
			setError(null);
			router.refresh();
		});
	};

	const pageCount = doc.page_count ?? 1;
	const docTypeLabel =
		doc.doc_type && doc.doc_type in DOC_TYPE_LABELS
			? DOC_TYPE_LABELS[doc.doc_type as DocType]
			: (doc.doc_type ?? "—");

	return (
		<main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-6 py-8">
			<header className="flex flex-wrap items-end justify-between gap-4">
				<div className="min-w-0">
					<Link
						href="/documents"
						className="font-mono text-xs uppercase tracking-[0.18em] text-brand-blue hover:text-brand-deep"
					>
						← Documents
					</Link>
					<h1 className="mt-1 truncate font-display text-2xl font-semibold tracking-tight text-brand-navy">
						{doc.filename}
					</h1>
					<p className="font-mono text-xs text-muted-foreground">
						{docTypeLabel} · {doc.status} ·{" "}
						{run ? `run #${run.extraction_run_id}` : "no extraction"}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						onClick={() => router.refresh()}
						disabled={isPending}
					>
						Refresh
					</Button>
					<Button onClick={onSave} disabled={!dirty || isPending}>
						{isPending
							? "Saving…"
							: `Save${dirty ? ` (${Object.keys(draft).length})` : ""}`}
					</Button>
				</div>
			</header>

			{error ? (
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<section className="flex flex-col gap-3">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<ScaleSlider scale={scale} onChange={setScale} />
						<div className="flex items-center gap-2">
							<span className="font-mono text-xs text-muted-foreground">
								Page {pageNo} / {pageCount}
							</span>
							<div className="flex gap-1">
								<Button
									variant="outline"
									size="sm"
									disabled={pageNo <= 1}
									onClick={() => setPageNo((n) => Math.max(1, n - 1))}
								>
									←
								</Button>
								<Button
									variant="outline"
									size="sm"
									disabled={pageNo >= pageCount}
									onClick={() => setPageNo((n) => Math.min(pageCount, n + 1))}
								>
									→
								</Button>
							</div>
						</div>
					</div>

					<PageOverlay
						imageSrc={`/api/documents/${doc.document_id}/pages/${pageNo}`}
						pageBlocks={pageBlocks}
						highlightedBlockId={highlightedBlockId}
						onHoverBlock={setHoveredBlock}
						scale={scale}
					/>
				</section>

				<section className="flex flex-col gap-6">
					{run ? (
						<>
							<div className="flex flex-col gap-3">
								<h2 className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
									<span>On page {pageNo}</span>
									<span className="text-[10px] text-ink-mute">
										({pageScalars.length})
									</span>
								</h2>
								{pageScalars.length > 0 ? (
									<KvpTable
										rows={pageScalars}
										draft={draft}
										onChange={(path, raw) =>
											setDraft((d) => ({ ...d, [path]: raw }))
										}
										remark={remark}
										onRemark={(path, txt) =>
											setRemark((r) => ({ ...r, [path]: txt }))
										}
										onHoverField={setHoveredField}
										highlightedField={highlightedFieldPath}
										anchors={anchors}
									/>
								) : (
									<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
										No fields anchored to this page.
									</p>
								)}
							</div>

							{docScalars.length > 0 ? (
								<div className="flex flex-col gap-3">
									<h2 className="flex items-baseline gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
										<span>Document-level</span>
										<span
											className="text-[10px] text-ink-mute"
											title="Fields the auto-anchor heuristic could not place on a specific page"
										>
											({docScalars.length}, unanchored)
										</span>
									</h2>
									<KvpTable
										rows={docScalars}
										draft={draft}
										onChange={(path, raw) =>
											setDraft((d) => ({ ...d, [path]: raw }))
										}
										remark={remark}
										onRemark={(path, txt) =>
											setRemark((r) => ({ ...r, [path]: txt }))
										}
										onHoverField={setHoveredField}
										highlightedField={highlightedFieldPath}
										anchors={anchors}
									/>
								</div>
							) : null}
						</>
					) : (
						<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
							No extraction yet.
						</p>
					)}

					{split.tables.map((t) => (
						<LineTable key={t.path} table={t} />
					))}
				</section>
			</div>

			{run && run.reviews.length > 0 ? (
				<section className="flex flex-col gap-3">
					<h2 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
						Audit log ({run.reviews.length})
					</h2>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Field</TableHead>
								<TableHead>Was</TableHead>
								<TableHead>Now</TableHead>
								<TableHead>Remark</TableHead>
								<TableHead>When</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{run.reviews.map((r) => (
								<TableRow key={`${r.field_path}-${r.created_at}`}>
									<TableCell className="font-mono text-xs">
										{r.field_path}
									</TableCell>
									<TableCell className="font-mono text-xs text-muted-foreground line-through">
										{stringify(r.original_value)}
									</TableCell>
									<TableCell className="font-mono text-xs">
										{stringify(r.edited_value)}
									</TableCell>
									<TableCell className="text-xs">{r.remark ?? ""}</TableCell>
									<TableCell className="font-mono text-xs text-muted-foreground">
										{new Date(r.created_at).toLocaleString()}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</section>
			) : null}
		</main>
	);
}

function stringify(v: unknown): string {
	if (v === null || v === undefined) return "—";
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}

interface KvpTableProps {
	rows: KvpRow[];
	draft: Record<string, string>;
	onChange: (path: string, raw: string) => void;
	remark: Record<string, string>;
	onRemark: (path: string, txt: string) => void;
	onHoverField: (path: string | null) => void;
	highlightedField: string | null;
	anchors: Record<string, string>;
}

function KvpTable({
	rows,
	draft,
	onChange,
	remark,
	onRemark,
	onHoverField,
	highlightedField,
	anchors,
}: KvpTableProps) {
	if (rows.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
				No fields extracted.
			</p>
		);
	}

	return (
		<dl className="divide-y rounded-md border bg-card">
			{rows.map((row) => {
				const isDirty = row.path in draft;
				const value = isDirty ? draft[row.path] : stringify(row.value);
				const hasAnchor = row.path in anchors;
				const isHighlighted = highlightedField === row.path;
				const bgClass = isHighlighted
					? "bg-brand-sky/30"
					: isDirty
						? "bg-edit/10"
						: "hover:bg-muted/40";
				return (
					<div
						key={row.path}
						onMouseEnter={() => hasAnchor && onHoverField(row.path)}
						onMouseLeave={() => hasAnchor && onHoverField(null)}
						className={`group flex flex-col gap-1 px-3 py-2 transition-colors ${bgClass} ${
							hasAnchor ? "cursor-help" : ""
						}`}
					>
						<dt className="flex items-center gap-2 break-all font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
							<span>{row.path}</span>
							{hasAnchor ? (
								<span
									className="inline-block h-1.5 w-1.5 rounded-full bg-brand-blue"
									title="Mapped to a region on the page"
								/>
							) : null}
						</dt>
						<dd>
							<input
								value={value}
								onChange={(e) => onChange(row.path, e.target.value)}
								className="w-full border-0 bg-transparent p-0 font-mono text-sm text-ink focus:bg-edit/5 focus:outline-none"
							/>
							{isDirty ? (
								<input
									placeholder="Add a remark (optional)"
									value={remark[row.path] ?? ""}
									onChange={(e) => onRemark(row.path, e.target.value)}
									className="mt-1 w-full border-0 border-t border-rule-soft bg-transparent p-0 pt-1 text-xs text-ink-mute focus:outline-none"
								/>
							) : null}
						</dd>
					</div>
				);
			})}
		</dl>
	);
}

function LineTable({ table }: { table: TableSection }) {
	return (
		<div className="flex flex-col gap-2">
			<h3 className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
				{table.path} ({table.rows.length})
			</h3>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>#</TableHead>
						{table.columns.map((c) => (
							<TableHead key={c}>{c}</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{table.rows.map((row, i) => (
						<TableRow key={`${table.path}-${i}`}>
							<TableCell className="font-mono text-xs text-muted-foreground">
								{i + 1}
							</TableCell>
							{table.columns.map((c) => (
								<TableCell key={c} className="font-mono text-xs">
									{cellDisplay(row[c])}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}

function cellDisplay(v: LeafValue): string {
	if (v === null) return "—";
	return String(v);
}
