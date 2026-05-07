"use client";

import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import refinementFixture from "@/lib/fixtures/refinement-run-2.json";

/**
 * Greybox wireframe for the document review screen.
 *
 * Goal of this iteration: lock in the structural grid, the field
 * presentation model (flat JSON KVP table), and the Live Text mechanic.
 * Visual styling deliberately kept minimal — soft slate borders,
 * generous whitespace, brand-blue used only where action lives.
 *
 * Once the skeleton is approved we'll layer the henghup.com corporate
 * polish back on (typography hierarchy, atmosphere, hero treatment).
 */

const PAGE_W = 1545;
const PAGE_H = 2000;
const PAGE_SRC = "/sample-page.png";

// Docling stores bboxes in PDF point space (595×842, BOTTOMLEFT origin).
// Convert to canvas TOPLEFT pixels (1545×2000) once at module load.
const PDF_W = 595.44;
const PDF_H = 842.04;
const SX = PAGE_W / PDF_W;
const SY = PAGE_H / PDF_H;

function fromDocling(l: number, t: number, r: number, b: number): BBox {
	return {
		x: l * SX,
		y: (PDF_H - t) * SY,
		w: (r - l) * SX,
		h: (t - b) * SY,
	};
}

interface BBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

interface OCRFragment {
	id: string;
	text: string;
	bbox: BBox;
}

type FieldStatus = "extracted" | "edited" | "missing";

interface FieldRow {
	key: string;
	value: string;
	status: FieldStatus;
	bbox?: BBox;
}

// Flat JSON KVP. Nested values get dot/bracket paths so the whole
// extraction collapses to a 2-column table the reviewer can scan.
const FIELDS: FieldRow[] = [
	{ key: "do_number", value: "DO-61581", status: "edited", bbox: fromDocling(401.67, 801.37, 530.67, 790.71) },
	{ key: "issued_on", value: "2025-11-18", status: "extracted", bbox: fromDocling(401.67, 786.04, 532.67, 777.71) },
	{ key: "purchase_order_no", value: "PO2511-102", status: "extracted", bbox: fromDocling(401.33, 773.37, 534.67, 764.04) },
	{ key: "terms", value: "C.B.D.", status: "extracted", bbox: fromDocling(401.67, 759.71, 513.33, 751.04) },
	{ key: "issuer.name", value: "GBI Mesh & Bar Trading Sdn Bhd", status: "extracted", bbox: fromDocling(45.0, 698.71, 228.0, 689.71) },
	{ key: "issuer.address", value: "8 Lorong Bakap Indah 10, Taman Bakap Indah, 14200 Sungai Bakap, Pulau Pinang, Malaysia", status: "extracted", bbox: fromDocling(45.0, 687.71, 177.0, 646.71) },
	{ key: "issuer.tel", value: "014-391 3419", status: "extracted", bbox: fromDocling(45.0, 640.37, 125.33, 631.71) },
	{ key: "sold_to.name", value: "Coltron Construction S/B-BCM", status: "extracted", bbox: fromDocling(314.33, 698.71, 543.0, 667.37) },
	{ key: "sold_to.address", value: "Lot 224 Kws Perindustrian Bukit Kayu Hitam, 06050 Bukit Kayu Hitam, Kedah", status: "extracted", bbox: fromDocling(314.33, 698.71, 543.0, 667.37) },
	{ key: "sold_to.contact", value: "Chew FK · 016-427 8338", status: "extracted", bbox: fromDocling(314.33, 654.37, 415.0, 646.04) },
	{ key: "lorry_no", value: "MDX 2829", status: "extracted", bbox: fromDocling(32.0, 229.04, 183.0, 210.71) },
	{ key: "ic_no", value: "800108-02-5923", status: "extracted", bbox: fromDocling(32.0, 209.04, 183.0, 192.71) },
	{ key: "driver_name", value: "Hafizalashwat", status: "extracted", bbox: fromDocling(34.67, 190.04, 169.0, 178.04) },
	{ key: "items[0].description", value: "HTD BARS 10MM × 12M (138PCS)(2 BDLS)", status: "extracted" },
	{ key: "items[0].quantity", value: "2.0440 MT", status: "extracted", bbox: fromDocling(496.33, 591.71, 539.67, 583.37) },
	{ key: "total", value: "2.0440 MT", status: "extracted", bbox: fromDocling(451.33, 263.71, 527.67, 255.71) },
];

// Live Text fragments — every OCR text span on the page with its
// bounding box. Used to render a transparent selectable text layer
// on top of the page image.
const OCR_FRAGMENTS: OCRFragment[] = [
	{ id: "f0", text: "Lot 3387, Jalan Keretapi Lama, Off Jalan Kapar, Batu 8,", bbox: fromDocling(62.33, 806.71, 171.33, 789.04) },
	{ id: "f1", text: "42200 Kapar, Klang, Selangor.", bbox: fromDocling(62.33, 788.71, 169.67, 779.71) },
	{ id: "f2", text: "Tel : 603-3259 2688 & 603-3259 1188", bbox: fromDocling(62.33, 780.04, 197.33, 771.71) },
	{ id: "f3", text: "Fax: 603-3259 2822", bbox: fromDocling(62.33, 770.04, 137.33, 762.71) },
	{ id: "f4", text: "Billing Address:", bbox: fromDocling(45.0, 712.71, 118.0, 700.04) },
	{ id: "f5", text: "GBI MESH & BAR TRADING SDN. BHD.", bbox: fromDocling(45.33, 698.71, 228.0, 689.71) },
	{ id: "f6", text: "8, LORONG BAKAP INDAH 10 TAMAN BAKAP INDAH 14200 SUNGAI BAKAP, PULAU PINANG MALAYSIA", bbox: fromDocling(45.0, 687.71, 177.0, 646.71) },
	{ id: "f7", text: "TEL: 014-391 3419", bbox: fromDocling(45.0, 640.37, 125.33, 631.71) },
	{ id: "f9", text: "FAX:", bbox: fromDocling(193.33, 640.71, 221.0, 632.04) },
	{ id: "f10", text: "Complaints if any should be lodged within (7) days after delivery of goods.", bbox: fromDocling(36.67, 266.37, 425.67, 246.37) },
	{ id: "f11", text: "Total:", bbox: fromDocling(451.33, 263.71, 479.0, 255.71) },
	{ id: "f12", text: "Quantity", bbox: fromDocling(499.33, 609.37, 537.0, 599.37) },
	{ id: "f13", text: "2.0440 MT", bbox: fromDocling(496.33, 591.71, 539.67, 583.37) },
	{ id: "f14", text: "2.0440", bbox: fromDocling(499.0, 263.37, 527.67, 256.04) },
	{ id: "f17", text: "SINTARI SDN BHD", bbox: fromDocling(172.67, 123.71, 487.67, 91.37) },
	{ id: "f18", text: "Received Above goods In Good Order And Condition,", bbox: fromDocling(352.0, 249.04, 562.33, 239.71) },
	{ id: "f19", text: "Transporter:", bbox: fromDocling(37.0, 238.71, 86.67, 229.04) },
	{ id: "f21", text: "Lorry No. : MDX 2829", bbox: fromDocling(32.0, 229.04, 183.0, 210.71) },
	{ id: "f21b", text: "I/C No. : 800108-02-5923", bbox: fromDocling(32.0, 209.04, 183.0, 192.71) },
	{ id: "f23", text: "Driver Name : Hafizalashwat", bbox: fromDocling(34.67, 190.04, 169.0, 178.04) },
	{ id: "f25", text: "For SINTARI SDN BHD", bbox: fromDocling(206.33, 177.37, 306.0, 169.04) },
	{ id: "f32", text: "E. & O.E", bbox: fromDocling(254.0, 251.37, 289.67, 243.04) },
	{ id: "f33", text: "Delivery Order", bbox: fromDocling(245.0, 741.04, 336.67, 729.71) },
	{ id: "f34", text: "Delivery Address:", bbox: fromDocling(314.33, 709.37, 393.67, 699.71) },
	{ id: "f35", text: "COLTRON CONSTRUCTION S/B-BCM LOT 224 KWS PERINDUSTRIAN BUKIT KAYU HITAM 06050 BUKIT KAYU HITAM, KEDAH", bbox: fromDocling(314.33, 698.71, 543.0, 667.37) },
	{ id: "f36", text: "CHEW FK 016-427 8338", bbox: fromDocling(314.33, 654.37, 415.0, 646.04) },
	{ id: "f37", text: "Delivery Order No : DO-61581", bbox: fromDocling(401.67, 801.37, 530.67, 790.71) },
	{ id: "f38", text: "Date : 18/11/2025", bbox: fromDocling(401.67, 786.04, 532.67, 777.71) },
	{ id: "f40", text: "Purchase Order No : PO2511-102", bbox: fromDocling(401.33, 773.37, 534.67, 764.04) },
	{ id: "f42", text: "Terms : C.B.D.", bbox: fromDocling(401.67, 759.71, 513.33, 751.04) },
];

export default function DesignPreviewPage() {
	const [hovered, setHovered] = useState<string | null>(null);
	const [selected, setSelected] = useState<string | null>(null);
	const [liveText, setLiveText] = useState(true);

	const focusField = (key: string) => {
		setSelected(key);
		document
			.getElementById(`row-${key}`)
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	};

	return (
		<div className="min-h-screen bg-white text-slate-700">
			<header className="flex items-center justify-between border-b border-slate-200 px-8 py-4">
				<div className="flex items-baseline gap-4">
					<span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
						Heng Hup Holdings
					</span>
					<h1 className="font-display text-base font-medium text-slate-900">
						Document Review
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<span className="font-mono text-xs text-slate-500">DO-61581</span>
					<button
						type="button"
						className="bg-brand-deep px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-white transition-colors hover:bg-brand-navy"
					>
						Save & confirm
					</button>
				</div>
			</header>

			<main className="grid grid-cols-12 gap-6 px-8 py-6">
				<section className="col-span-7">
					<Wireframe
						label="Page · 1 of 1"
						aside={
							<div className="flex items-center gap-3 text-[10px] text-slate-400">
								<span className="font-mono">1545 × 2000</span>
								<button
									type="button"
									onClick={() => setLiveText((v) => !v)}
									aria-pressed={liveText}
									className={`border px-2 py-0.5 font-medium uppercase tracking-wider transition-colors ${
										liveText
											? "border-brand-blue text-brand-blue"
											: "border-slate-200 text-slate-400"
									}`}
								>
									Live Text {liveText ? "on" : "off"}
								</button>
							</div>
						}
					>
						<DocumentCanvas
							hovered={hovered}
							selected={selected}
							fields={FIELDS}
							liveText={liveText}
							onFocus={focusField}
						/>
					</Wireframe>
				</section>

				<section className="col-span-5">
					<Wireframe
						label="Fields · JSON"
						aside={
							<span className="font-mono text-[10px] text-slate-400">
								{FIELDS.length} keys · {countByStatus(FIELDS, "edited")} edited
							</span>
						}
					>
						<KVPTable
							rows={FIELDS}
							hovered={hovered}
							selected={selected}
							onHover={setHovered}
							onFocus={focusField}
						/>
					</Wireframe>
				</section>
			</main>

			<section className="space-y-6 px-8 pb-10">
				<RefinementPanel />
				<Wireframe label="Audit · placeholder">
					<div className="grid h-24 place-items-center text-[11px] text-slate-300">
						audit timeline goes here
					</div>
				</Wireframe>
			</section>
		</div>
	);
}

/* ── Wireframe — minimal section frame with label + optional aside ───── */
function Wireframe({
	label,
	aside,
	children,
}: {
	label: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div>
			<div className="mb-2 flex items-end justify-between">
				<span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
					{label}
				</span>
				{aside}
			</div>
			<div className="border border-slate-200 bg-white">{children}</div>
		</div>
	);
}

/* ── DocumentCanvas — page image + Live Text + bbox overlay ────────── */
function DocumentCanvas({
	hovered,
	selected,
	fields,
	liveText,
	onFocus,
}: {
	hovered: string | null;
	selected: string | null;
	fields: FieldRow[];
	liveText: boolean;
	onFocus: (key: string) => void;
}) {
	const vlmBoxes = useVLMAddPatches();

	return (
		<PageOverlay naturalWidth={PAGE_W} naturalHeight={PAGE_H}>
			<img
				src={PAGE_SRC}
				alt="Delivery order page 1"
				className="absolute inset-0 h-full w-full select-none"
				draggable={false}
			/>
			{liveText && (
				<TextLayer
					fragments={OCR_FRAGMENTS}
					naturalWidth={PAGE_W}
					naturalHeight={PAGE_H}
				/>
			)}
			{fields.map(
				(f) =>
					f.bbox && (
						<BBoxRect
							key={f.key}
							bbox={f.bbox}
							naturalWidth={PAGE_W}
							naturalHeight={PAGE_H}
							state={
								selected === f.key
									? "selected"
									: hovered === f.key
										? "hovered"
										: "default"
							}
							label={f.key}
							onClick={() => onFocus(f.key)}
							interactive={!liveText}
						/>
					),
			)}
			{vlmBoxes.map((b) => (
				<VLMBBoxRect
					key={`vlm-${b.field_key}`}
					bbox={b.bbox}
					naturalWidth={PAGE_W}
					naturalHeight={PAGE_H}
					label={b.field_key}
					confidence={b.confidence}
				/>
			))}
		</PageOverlay>
	);
}

/**
 * Pull the `add` patches out of the refinement fixture and convert
 * Gemma's 1000x1000 normalized coords into our 1545x2000 page-natural
 * sandbox space. Only emits when text + box_2d are both present.
 */
function useVLMAddPatches(): {
	field_key: string;
	bbox: BBox;
	confidence: number;
}[] {
	const data = refinementFixture as unknown as {
		result: {
			patches: {
				op: string;
				field_key: string | null;
				box_2d: number[] | null;
				confidence: number;
			}[];
		};
	};
	return data.result.patches
		.filter(
			(p) =>
				p.op === "add" &&
				p.field_key &&
				Array.isArray(p.box_2d) &&
				p.box_2d.length === 4,
		)
		.map((p) => {
			const [x1, y1, x2, y2] = p.box_2d as [number, number, number, number];
			return {
				field_key: p.field_key as string,
				confidence: p.confidence,
				bbox: {
					x: (x1 / 1000) * PAGE_W,
					y: (y1 / 1000) * PAGE_H,
					w: ((x2 - x1) / 1000) * PAGE_W,
					h: ((y2 - y1) / 1000) * PAGE_H,
				},
			};
		});
}

/**
 * Distinct visual style for VLM-added regions. Pink/magenta tone so
 * they read as separate from the slate OCR bboxes. Confidence drives
 * border weight; label + value chip floats above the bbox so the user
 * can tell at-a-glance what Gemma proposed.
 */
function VLMBBoxRect({
	bbox,
	naturalWidth,
	naturalHeight,
	label,
	confidence,
}: {
	bbox: BBox;
	naturalWidth: number;
	naturalHeight: number;
	label: string;
	confidence: number;
}) {
	const style: CSSProperties = {
		left: `${(bbox.x / naturalWidth) * 100}%`,
		top: `${(bbox.y / naturalHeight) * 100}%`,
		width: `${(bbox.w / naturalWidth) * 100}%`,
		height: `${(bbox.h / naturalHeight) * 100}%`,
	};
	const borderClass = confidence >= 0.85 ? "border-2" : "border";
	return (
		<div
			className={`pointer-events-none absolute ${borderClass} border-fuchsia-500/70 bg-fuchsia-500/5`}
			style={style}
			aria-label={`VLM proposed ${label}`}
		>
			<span className="absolute -top-4 left-0 bg-fuchsia-500 px-1 py-px font-mono text-[8px] font-medium uppercase tracking-wider text-white">
				vlm · {label}
			</span>
		</div>
	);
}

/* ── PageOverlay — aspect-locked container that anchors all overlays ─── */
function PageOverlay({
	naturalWidth,
	naturalHeight,
	children,
}: {
	naturalWidth: number;
	naturalHeight: number;
	children: ReactNode;
}) {
	return (
		<div
			className="relative w-full bg-white"
			style={{
				aspectRatio: `${naturalWidth} / ${naturalHeight}`,
				containerType: "inline-size",
			}}
		>
			{children}
		</div>
	);
}

/* ── BBoxRect — visual region marker tied to a field ──────────────── */
type BBoxState = "default" | "hovered" | "selected";

function BBoxRect({
	bbox,
	naturalWidth,
	naturalHeight,
	state,
	onClick,
	label,
	interactive = true,
}: {
	bbox: BBox;
	naturalWidth: number;
	naturalHeight: number;
	state: BBoxState;
	onClick?: () => void;
	label?: string;
	interactive?: boolean;
}) {
	const style: CSSProperties = {
		left: `${(bbox.x / naturalWidth) * 100}%`,
		top: `${(bbox.y / naturalHeight) * 100}%`,
		width: `${(bbox.w / naturalWidth) * 100}%`,
		height: `${(bbox.h / naturalHeight) * 100}%`,
	};

	const visual: Record<BBoxState, string> = {
		default: "border border-brand-blue/0 hover:border-brand-blue/40",
		hovered: "border border-brand-blue/70 bg-brand-blue/5",
		selected: "border-2 border-brand-blue bg-brand-blue/10",
	};

	const ptr = interactive ? "cursor-pointer" : "pointer-events-none";

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className={`absolute transition-colors duration-150 focus:outline-none ${ptr} ${visual[state]}`}
			style={style}
		/>
	);
}

/* ── TextLayer — Apple Live Text trick ──────────────────────────────────
 *
 * Transparent text spans positioned over the page image at OCR-reported
 * bboxes. Browser-native selection handles drag-select, copy, find, and
 * translate. PDF.js uses the same technique for selectable PDFs.
 *
 * fontSize is expressed in `cqw` units (container query width), which
 * resolve against the nearest ancestor with `container-type: inline-size`
 * — that's the <PageOverlay> wrapper. This keeps the transparent glyph
 * sized exactly to the rendered bbox height regardless of viewport.
 *
 * useLayoutEffect measures the rendered span width post-mount and applies
 * a horizontal scaleX so the selection rectangle hugs the bbox exactly.
 *
 * Phase A is fragment-level — single-click selects whole Docling spans
 * (paragraph or line). Phase B will derive word-level boxes via
 * proportional split on the same line bboxes (no extra OCR call needed).
 */
function TextLayer({
	fragments,
	naturalWidth,
	naturalHeight,
}: {
	fragments: OCRFragment[];
	naturalWidth: number;
	naturalHeight: number;
}) {
	return (
		<div
			className="text-layer absolute inset-0 cursor-text select-text"
			style={{ lineHeight: 1, whiteSpace: "pre" }}
		>
			{fragments.map((f) => (
				<TextSpan
					key={f.id}
					fragment={f}
					naturalWidth={naturalWidth}
					naturalHeight={naturalHeight}
				/>
			))}
		</div>
	);
}

function TextSpan({
	fragment,
	naturalWidth,
	naturalHeight,
}: {
	fragment: OCRFragment;
	naturalWidth: number;
	naturalHeight: number;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const [scaleX, setScaleX] = useState(1);

	useLayoutEffect(() => {
		const el = ref.current;
		const parent = el?.parentElement?.parentElement;
		if (!el || !parent) return;
		// Defer to the next frame so cqw-based fontSize has settled.
		const handle = requestAnimationFrame(() => {
			const measured = el.getBoundingClientRect().width;
			const target = (fragment.bbox.w / naturalWidth) * parent.clientWidth;
			if (measured > 0) setScaleX(target / measured);
		});
		return () => cancelAnimationFrame(handle);
	}, [fragment.bbox.w, naturalWidth]);

	// fontSize: bbox height as a percentage of container width works
	// because aspect-ratio locks height and width together. Math:
	//   rendered_h_px = (bbox.h / naturalHeight) * containerHeight
	//                 = (bbox.h / naturalHeight) * containerWidth * (naturalHeight/naturalWidth)
	//                 = (bbox.h / naturalWidth) * containerWidth
	const style: CSSProperties = {
		left: `${(fragment.bbox.x / naturalWidth) * 100}%`,
		top: `${(fragment.bbox.y / naturalHeight) * 100}%`,
		fontSize: `${(fragment.bbox.h / naturalWidth) * 100}cqw`,
		transformOrigin: "0 0",
		transform: `scaleX(${scaleX})`,
		color: "transparent",
		fontKerning: "none",
		fontVariantLigatures: "none",
	};

	return (
		<span ref={ref} className="absolute font-body" style={style}>
			{fragment.text}
		</span>
	);
}

/* ── KVPTable — flat JSON view of the extracted record ─────────────── */
function KVPTable({
	rows,
	hovered,
	selected,
	onHover,
	onFocus,
}: {
	rows: FieldRow[];
	hovered: string | null;
	selected: string | null;
	onHover: (k: string | null) => void;
	onFocus: (k: string) => void;
}) {
	return (
		<table className="w-full table-fixed text-sm">
			<colgroup>
				<col className="w-[42%]" />
				<col className="w-[58%]" />
			</colgroup>
			<tbody className="divide-y divide-slate-100">
				{rows.map((f) => {
					const isHover = hovered === f.key;
					const isSel = selected === f.key;
					const rowBg = isSel
						? "bg-brand-blue/8"
						: isHover
							? "bg-slate-50"
							: "";
					return (
						<tr
							id={`row-${f.key}`}
							key={f.key}
							className={`group cursor-pointer transition-colors ${rowBg}`}
							onMouseEnter={() => onHover(f.key)}
							onMouseLeave={() => onHover(null)}
							onClick={() => onFocus(f.key)}
						>
							<th
								scope="row"
								className="border-l-2 border-transparent py-2 pl-3 pr-2 text-left align-top font-mono text-[12px] font-normal text-slate-500 group-hover:border-brand-blue/30"
								style={{
									borderLeftColor: isSel
										? "hsl(var(--brand-blue))"
										: undefined,
								}}
							>
								{f.key}
							</th>
							<td className="py-2 pl-2 pr-3 align-top font-mono text-[13px] text-slate-900">
								<div className="flex items-start justify-between gap-3">
									<span className="break-words">{f.value}</span>
									<StatusTag status={f.status} />
								</div>
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

function StatusTag({ status }: { status: FieldStatus }) {
	if (status === "extracted") return null;
	const map: Record<Exclude<FieldStatus, "extracted">, string> = {
		edited: "text-amber-600",
		missing: "text-rose-600",
	};
	return (
		<span
			className={`shrink-0 font-mono text-[10px] font-medium uppercase tracking-wider ${map[status]}`}
		>
			{status}
		</span>
	);
}

function countByStatus(rows: FieldRow[], status: FieldStatus): number {
	return rows.filter((r) => r.status === status).length;
}

/* ── Refinement panel — VLM (Gemma 4) output via DSPy / ARQ ──────────
 *
 * Reads a frozen fixture pulled from a real `POST /refine/2` call and
 * surfaces what the VLM produced:
 *   • header — model + prompt_version + duration_ms (the observability)
 *   • discrepancies callout — the most actionable signal
 *   • patches table — assign/reject ops with confidence + reason
 *   • collapsible visual_audit + scaffold_match (the ARQ trace)
 *
 * Live wiring will swap the JSON import for an authenticated fetch
 * against `GET /refine/{extraction_run_id}/current`. Shape stays
 * identical so the component doesn't change.
 */
interface RefinementPatch {
	op: "assign" | "add" | "reject" | "move";
	fragment_id: string | null;
	field_key: string | null;
	new_bbox: unknown;
	new_text: string | null;
	reason: string;
	confidence: number;
}

interface RefinementFixture {
	refinement_run_id: number;
	extraction_run_id: number;
	vlm_model: string;
	prompt_version: string;
	duration_ms: number;
	token_usage: { prompt_tokens: number | null; completion_tokens: number | null; total_tokens: number | null } | null;
	result: {
		arq_trace: {
			visual_audit: string;
			scaffold_match: string;
			discrepancies: string;
		};
		patches: RefinementPatch[];
	};
}

function RefinementPanel() {
	const data = refinementFixture as unknown as RefinementFixture;
	const { result, vlm_model, prompt_version, duration_ms } = data;

	return (
		<Wireframe
			label="VLM Refinement · Gemma 4 + DSPy/ARQ"
			aside={
				<div className="flex items-center gap-3 font-mono text-[10px] text-slate-400">
					<span>{vlm_model}</span>
					<span>·</span>
					<span>{prompt_version}</span>
					<span>·</span>
					<span>{duration_ms} ms</span>
					<span>·</span>
					<span>{result.patches.length} patches</span>
				</div>
			}
		>
			<div className="space-y-0 divide-y divide-slate-100">
				<DiscrepanciesCallout text={result.arq_trace.discrepancies} />
				<PatchesTable patches={result.patches} />
				<ARQDetails
					visualAudit={result.arq_trace.visual_audit}
					scaffoldMatch={result.arq_trace.scaffold_match}
				/>
			</div>
		</Wireframe>
	);
}

function DiscrepanciesCallout({ text }: { text: string }) {
	return (
		<div className="bg-amber-50/60 px-4 py-3">
			<div className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-700">
				Discrepancies
			</div>
			<p className="mt-1 text-[13px] leading-snug text-slate-800">{text}</p>
		</div>
	);
}

function PatchesTable({ patches }: { patches: RefinementPatch[] }) {
	return (
		<div className="px-4 py-3">
			<div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
				Patches
			</div>
			<div className="overflow-hidden">
				<table className="w-full table-fixed text-[12px]">
					<colgroup>
						<col className="w-[60px]" />
						<col className="w-[110px]" />
						<col className="w-[160px]" />
						<col className="w-[60px]" />
						<col />
					</colgroup>
					<thead>
						<tr className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-400">
							<th className="px-2 py-1 font-normal">op</th>
							<th className="px-2 py-1 font-normal">fragment_id</th>
							<th className="px-2 py-1 font-normal">field_key</th>
							<th className="px-2 py-1 font-normal text-right">conf</th>
							<th className="px-2 py-1 font-normal">reason</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{patches.map((p, i) => (
							<tr key={`${p.fragment_id}-${p.field_key}-${i}`}>
								<td className="px-2 py-1.5">
									<OpChip op={p.op} />
								</td>
								<td className="px-2 py-1.5 font-mono text-slate-600">
									{p.fragment_id ?? "—"}
								</td>
								<td className="px-2 py-1.5 font-mono text-slate-900">
									{p.field_key ?? "—"}
								</td>
								<td className="px-2 py-1.5 text-right">
									<ConfidenceCell value={p.confidence} />
								</td>
								<td className="px-2 py-1.5 text-slate-700">{p.reason}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function OpChip({ op }: { op: RefinementPatch["op"] }) {
	const styles: Record<RefinementPatch["op"], string> = {
		assign: "bg-brand-blue/10 text-brand-blue",
		reject: "bg-rose-50 text-rose-700",
		add: "bg-emerald-50 text-emerald-700",
		move: "bg-amber-50 text-amber-700",
	};
	return (
		<span
			className={`inline-block px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${styles[op]}`}
		>
			{op}
		</span>
	);
}

function ConfidenceCell({ value }: { value: number }) {
	const tone =
		value >= 0.85
			? "text-emerald-700"
			: value >= 0.6
				? "text-amber-700"
				: "text-rose-700";
	return (
		<span className={`font-mono ${tone}`}>{value.toFixed(2)}</span>
	);
}

function ARQDetails({
	visualAudit,
	scaffoldMatch,
}: {
	visualAudit: string;
	scaffoldMatch: string;
}) {
	return (
		<div className="grid grid-cols-2 gap-px bg-slate-100">
			<details className="bg-white px-4 py-3">
				<summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 hover:text-slate-600">
					Visual audit ▸
				</summary>
				<p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
					{visualAudit}
				</p>
			</details>
			<details className="bg-white px-4 py-3">
				<summary className="cursor-pointer text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400 hover:text-slate-600">
					Scaffold match ▸
				</summary>
				<p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">
					{scaffoldMatch}
				</p>
			</details>
		</div>
	);
}
