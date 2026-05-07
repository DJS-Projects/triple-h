"use client";

import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Static design preview for the bento warehouse style direction.
 * No API calls — all data is mock, but the page image is a real
 * pre-rendered PNG pulled from blob_data so the bbox alignment
 * proof is honest. Used to validate aesthetics before scaffolding
 * the live /documents/[id] route.
 *
 * BBox coordinate model
 * ---------------------
 * All bbox positions are in **page-natural pixel coordinates** —
 * the same units the backend stores in `document_page.width_px /
 * height_px` and that Chandra OCR produces on its output. The
 * <PageOverlay> wrapper sets `aspect-ratio: width/height` so both
 * the page <img> and each <BBox> div consume identical percentage
 * space. This guarantees pixel-perfect alignment at any container
 * size and survives zoom-pan because the transform applies to the
 * wrapper, not to image/overlay independently.
 */

// PNG re-rendered at Chandra's bbox coord space (1545×2000) so OCR
// bboxes pulled from extraction_run.payload.docling_doc.texts[*].prov
// align 1:1 without scale gymnastics.
const PAGE_W = 1545;
const PAGE_H = 2000;
const PAGE_SRC = "/sample-page.png";

// Docling stores bboxes in PDF point space, BOTTOMLEFT origin.
// Convert to our canvas TOPLEFT pixel space once at module load.
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

interface FieldDef {
	key: string;
	label: string;
	value: string;
	mono?: boolean;
	status: FieldStatus;
	bbox?: BBox;
}

interface ItemRow {
	idx: number;
	desc: string;
	qty: string; // "2.0640 MT"
	weight?: number;
}

interface AuditEntry {
	id: number;
	field: string;
	before: string | null;
	after: string;
	reviewer: string;
	when: string;
}

// Real OCR bboxes pulled from
//   extraction_run.payload.docling_doc.texts[*].prov[0].bbox
// for document f0a24337-286d-47ba-896c-b6d1e9c8b6ce.
// Format: Docling {l,t,r,b} → {x:l, y:t, w:r-l, h:b-t}.
const PRIMARY_FIELDS: FieldDef[] = [
	{
		key: "header_block",
		label: "Header Block",
		value: "DO No · Date · PO No · Terms",
		mono: true,
		status: "extracted",
		// Chandra fragment: "Delivery Order No : DO-61581 Date : 18/11/2025 ..."
		bbox: { x: 1066, y: 109, w: 376, h: 139 },
	},
	{
		key: "do_number",
		label: "DO Number",
		value: "DO-61581",
		mono: true,
		status: "edited",
		// sub-region of header_block — first line
		bbox: { x: 1066, y: 109, w: 376, h: 35 },
	},
	{
		key: "issued_on",
		label: "Issued",
		value: "2025-11-18",
		mono: true,
		status: "extracted",
		bbox: { x: 1066, y: 145, w: 376, h: 35 },
	},
	{
		key: "issuer",
		label: "Issuer",
		value: "GBI Mesh & Bar Trading Sdn Bhd",
		status: "extracted",
		bbox: { x: 119, y: 380, w: 489, h: 186 },
	},
];

const PARTY_FIELDS: FieldDef[] = [
	{
		key: "sold_to",
		label: "Sold To",
		value: "Coltron Construction S/B-BCM",
		status: "extracted",
		bbox: { x: 837, y: 383, w: 632, h: 145 },
	},
	{
		key: "lorry_no",
		label: "Lorry No.",
		value: "MDX 2829",
		mono: true,
		status: "extracted",
		bbox: { x: 97, y: 1639, w: 284, h: 49 },
	},
];

const ITEMS: ItemRow[] = [
	{ idx: 1, desc: "HTD BARE 10MM × 12M (3BPCS/2 BDLS)", qty: "2.0440 MT" },
];

// "Total : 2.0440" bbox
const ITEM_BBOX: BBox = { x: 1201, y: 1534, w: 221, h: 29 };

// Live Text fragments — every OCR text span on the page with its
// bounding box. Pulled from
//   local-shared-data/traces/.../docling_document.json (.texts[*].prov[0].bbox)
// Original space: PDF points 595.44×842.04, BOTTOMLEFT origin.
// Converted via fromDocling() → CSS TOPLEFT pixels in 1545×2000.
//
// Selection-quality note: Docling fragments are line/paragraph level.
// Drag-select picks up whole spans, not individual words. Word-level
// requires a Tesseract second pass on the page PNG (Phase B).
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
	{ id: "f10", text: "Complaints if any should be lodged within (7) days after delivery of goods. We will not be held responsible for any defects if brought to our notice thereafter.", bbox: fromDocling(36.67, 266.37, 425.67, 246.37) },
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

const AUDIT: AuditEntry[] = [
	{
		id: 3,
		field: "do_number",
		before: "DO-61881",
		after: "DO-61581",
		reviewer: "Darren",
		when: "2m ago",
	},
	{
		id: 2,
		field: "lorry_no",
		before: "MDX 2820",
		after: "MDX 2829",
		reviewer: "Darren",
		when: "4m ago",
	},
	{
		id: 1,
		field: "sold_to",
		before: null,
		after: "Coltron Construction S/B-BCM",
		reviewer: "Darren",
		when: "5m ago",
	},
];

export default function DesignPreviewPage() {
	const [hoveredField, setHoveredField] = useState<string | null>(null);
	const [selectedField, setSelectedField] = useState<string | null>(null);

	const focusField = (key: string) => {
		setSelectedField(key);
		setHoveredField(key);
		document
			.getElementById(`field-${key}`)
			?.scrollIntoView({ behavior: "smooth", block: "center" });
	};

	return (
		<div className="min-h-screen bg-paper">
			{/* sky banner strip */}
			<div className="h-[3px] bg-gradient-to-r from-brand-deep via-brand-blue to-brand-sky" />

			{/* top bar */}
			<header className="reveal flex items-center justify-between border-b border-rule px-8 py-5">
				<div className="flex items-center gap-5">
					<HHHMark />
					<div className="flex flex-col gap-0.5">
						<span className="label leading-none text-brand-blue">
							Heng Hup Holdings
						</span>
						<div className="flex items-baseline gap-4">
							<h1 className="font-display text-[26px] font-medium leading-none tracking-tight text-brand-navy">
								Delivery Order
							</h1>
							<span className="font-mono text-[14px] text-ink">DO-61581</span>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className="stamp text-tag">
						<span className="dot-tag" />
						extracted
					</span>
					<button
						type="button"
						className="border border-rule bg-brand-navy px-4 py-2 font-body text-[12px] font-medium uppercase tracking-[0.12em] text-paper hover:bg-brand-deep transition-colors"
					>
						Save & mark reviewed
					</button>
				</div>
			</header>

			{/* bento body */}
			<div className="grid grid-cols-12 border-b border-rule">
				{/* doc canvas — 7 cols */}
				<section className="reveal col-span-7 border-r border-rule bg-paper p-6 [animation-delay:80ms]">
					<DocumentCanvas
						highlight={hoveredField}
						selected={selectedField}
						fields={[...PRIMARY_FIELDS, ...PARTY_FIELDS]}
						itemBbox={ITEM_BBOX}
						onFocus={focusField}
					/>
				</section>

				{/* form panel — 5 cols */}
				<section className="col-span-5 grid grid-rows-[auto_auto_1fr] divide-y divide-rule">
					<FieldGroup
						title="Primary"
						fields={PRIMARY_FIELDS}
						onHover={setHoveredField}
						selected={selectedField}
						delay={140}
					/>
					<FieldGroup
						title="Parties"
						fields={PARTY_FIELDS}
						onHover={setHoveredField}
						selected={selectedField}
						delay={200}
						twoCol
					/>
					<ItemsTable items={ITEMS} delay={260} />
				</section>
			</div>

			{/* audit footer */}
			<footer className="grid grid-cols-12">
				<aside className="col-span-2 border-r border-rule p-4">
					<div className="label mb-3">Pages</div>
					<div className="flex flex-col gap-2">
						{[1].map((p) => (
							<button
								type="button"
								key={p}
								className="flex h-14 w-full items-center justify-center border-2 border-edit bg-card font-mono text-[13px]"
							>
								{p}
							</button>
						))}
						<div className="mt-2 font-mono text-[10px] text-ink-mute">
							1 / 1
						</div>
					</div>
				</aside>

				<div className="reveal col-span-10 p-6 [animation-delay:320ms]">
					<div className="label mb-4 flex items-center gap-3">
						Audit
						<span className="font-mono text-[10px] text-ink">
							({AUDIT.length})
						</span>
					</div>
					<ul className="divide-y divide-rule-soft">
						{AUDIT.map((e) => (
							<AuditRow key={e.id} entry={e} />
						))}
					</ul>
				</div>
			</footer>
		</div>
	);
}

/* ── HHH wordmark — 3 stacked diamonds matching henghup.com logo ───── */
function HHHMark() {
	return (
		<svg
			viewBox="0 0 64 24"
			className="h-7 w-[72px]"
			aria-label="Heng Hup Holdings"
			role="img"
		>
			<title>Heng Hup Holdings</title>
			<rect
				x="2"
				y="6"
				width="14"
				height="14"
				transform="rotate(45 9 13)"
				fill="hsl(var(--brand-navy))"
			/>
			<rect
				x="20"
				y="2"
				width="14"
				height="14"
				transform="rotate(45 27 9)"
				fill="hsl(var(--brand-blue))"
			/>
			<rect
				x="38"
				y="6"
				width="14"
				height="14"
				transform="rotate(45 45 13)"
				fill="hsl(var(--brand-navy))"
			/>
		</svg>
	);
}

/* ── PageOverlay ────────────────────────────────────────────────────── */
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
			className="relative w-full bg-card border border-rule shadow-[0_1px_0_0_hsl(var(--rule)/0.4)]"
			style={{ aspectRatio: `${naturalWidth} / ${naturalHeight}` }}
		>
			{children}
		</div>
	);
}

/* ── BBoxRect — 4 visual states ─────────────────────────────────────── */
type BBoxState = "default" | "hovered" | "edited" | "selected";

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
	const style = {
		left: `${(bbox.x / naturalWidth) * 100}%`,
		top: `${(bbox.y / naturalHeight) * 100}%`,
		width: `${(bbox.w / naturalWidth) * 100}%`,
		height: `${(bbox.h / naturalHeight) * 100}%`,
	} as const;

	const visualByState: Record<BBoxState, string> = {
		default: "border border-brand-blue/30 hover:border-brand-blue/70",
		hovered: "border-2 border-brand-blue bg-brand-blue/8",
		edited: "border border-edit/70 bg-edit/8 hover:border-edit",
		selected: "border-2 border-edit bg-edit/15 ring-2 ring-edit/30",
	};

	// pointer-events: none lets the underlying TextLayer receive
	// drag-select. Visual highlight still drives from form-panel hover.
	const ptrClass = interactive ? "cursor-pointer" : "pointer-events-none";

	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			className={`absolute transition-all duration-150 focus:outline-none ${ptrClass} ${visualByState[state]}`}
			style={style}
		/>
	);
}

/* ── TextLayer — Apple Live Text trick ──────────────────────────────────
 *
 * Transparent text spans positioned over the page image at OCR-reported
 * bboxes. Browser-native selection handles drag-select, copy, find,
 * and translate. Same technique PDF.js uses for selectable PDFs.
 *
 * Selection visibility comes from `::selection` on `.text-layer ::selection`
 * (defined in globals.css). Text colour stays transparent so the
 * underlying image glyphs remain authoritative; only the selection
 * highlight is rendered.
 *
 * Phase A limitation: fragments are paragraph/line level (Docling output),
 * so single-click selects whole spans. Word-level granularity requires
 * a Tesseract second-pass on the page PNG (Phase B).
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
			className="text-layer absolute inset-0 cursor-text select-text leading-none whitespace-pre"
			aria-hidden="false"
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

	// Measure the rendered span post-mount and derive horizontal scale
	// so the transparent text occupies exactly the bbox width. Without
	// this the selection rectangle drifts left/right relative to the
	// painted glyphs as fonts/zoom change.
	useLayoutEffect(() => {
		const el = ref.current;
		const parent = el?.parentElement;
		if (!el || !parent) return;
		const target = (fragment.bbox.w / naturalWidth) * parent.clientWidth;
		const measured = el.getBoundingClientRect().width;
		if (measured > 0) setScaleX(target / measured);
	}, [fragment.bbox.w, naturalWidth]);

	const style = {
		left: `${(fragment.bbox.x / naturalWidth) * 100}%`,
		top: `${(fragment.bbox.y / naturalHeight) * 100}%`,
		fontSize: `${(fragment.bbox.h / naturalHeight) * 100}%`,
		transformOrigin: "0 0",
		transform: `scaleX(${scaleX})`,
	} as const;

	return (
		<span
			ref={ref}
			className="absolute font-body text-transparent"
			style={{
				...style,
				fontKerning: "none",
				fontVariantLigatures: "none",
			}}
		>
			{fragment.text}
		</span>
	);
}

/* ── DocumentCanvas — real PNG + zoom-pan + bbox overlay ────────────── */
function DocumentCanvas({
	highlight,
	selected,
	fields,
	itemBbox,
	onFocus,
}: {
	highlight: string | null;
	selected: string | null;
	fields: FieldDef[];
	itemBbox: BBox;
	onFocus: (key: string) => void;
}) {
	const [liveText, setLiveText] = useState(true);

	const stateFor = (f: FieldDef): BBoxState => {
		if (selected === f.key) return "selected";
		if (highlight === f.key) return "hovered";
		if (f.status === "edited") return "edited";
		return "default";
	};

	return (
		<div className="relative">
			<div className="mb-3 flex items-center justify-between">
				<div className="label flex items-center gap-2">
					Page 1
					<span className="font-mono text-[10px] text-ink-mute">
						1545 × 2000 px
					</span>
				</div>
				<div className="flex items-center gap-3">
					<span className="font-mono text-[10px] text-ink-mute">
						hover field → flare bbox · drag-select page → copy text
					</span>
					<button
						type="button"
						onClick={() => setLiveText((v) => !v)}
						aria-pressed={liveText}
						className={`stamp transition-colors ${
							liveText
								? "border-brand-blue text-brand-blue"
								: "text-ink-mute"
						}`}
					>
						<span
							className={`dot ${liveText ? "bg-brand-blue" : "bg-rule-soft"}`}
							aria-hidden="true"
						/>
						Live Text
					</button>
				</div>
			</div>

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
								state={stateFor(f)}
								label={`${f.label} on page`}
								onClick={() => onFocus(f.key)}
								interactive={!liveText}
							/>
						),
				)}
				<BBoxRect
					bbox={itemBbox}
					naturalWidth={PAGE_W}
					naturalHeight={PAGE_H}
					state={
						selected === "items"
							? "selected"
							: highlight === "items"
								? "hovered"
								: "default"
					}
					label="Items table on page"
					onClick={() => onFocus("items")}
					interactive={!liveText}
				/>
			</PageOverlay>
		</div>
	);
}

/* ── field group ────────────────────────────────────────────────────── */
function FieldGroup({
	title,
	fields,
	onHover,
	selected,
	delay,
	twoCol,
}: {
	title: string;
	fields: FieldDef[];
	onHover: (k: string | null) => void;
	selected: string | null;
	delay: number;
	twoCol?: boolean;
}) {
	return (
		<div className="reveal p-6" style={{ animationDelay: `${delay}ms` }}>
			<div className="label mb-4">{title}</div>
			<div
				className={`grid gap-px bg-rule-soft ${twoCol ? "grid-cols-2" : "grid-cols-1"}`}
			>
				{fields.map((f) => (
					<FieldCard
						key={f.key}
						field={f}
						onHover={onHover}
						isSelected={selected === f.key}
					/>
				))}
			</div>
		</div>
	);
}

function FieldCard({
	field,
	onHover,
	isSelected,
}: {
	field: FieldDef;
	onHover: (k: string | null) => void;
	isSelected: boolean;
}) {
	const ringClass = isSelected
		? "border-edit"
		: "border-transparent hover:border-tag";
	return (
		<div
			id={`field-${field.key}`}
			onMouseEnter={() => onHover(field.key)}
			onMouseLeave={() => onHover(null)}
			className={`group relative cursor-text border bg-card p-3 transition-[border-color,transform] duration-150 hover:-translate-x-px ${ringClass}`}
		>
			<div className="flex items-center gap-2">
				{field.status === "edited" && (
					<span className="dot-edit" aria-label="edited" />
				)}
				{field.status === "missing" && (
					<span className="dot-warn" aria-label="missing" />
				)}
				<span className="label">{field.label}</span>
			</div>
			<div
				className={`mt-1 text-[14px] leading-tight ${
					field.status === "missing" ? "text-ink-mute italic" : "text-ink"
				} ${field.mono ? "font-mono tabular" : "font-body"}`}
			>
				{field.value}
			</div>
			{field.bbox && (
				<span className="absolute right-3 top-3 font-mono text-[10px] text-tag opacity-0 transition-opacity group-hover:opacity-100">
					▶ on page
				</span>
			)}
		</div>
	);
}

/* ── items table ────────────────────────────────────────────────────── */
function ItemsTable({ items, delay }: { items: ItemRow[]; delay: number }) {
	return (
		<div className="reveal p-6" style={{ animationDelay: `${delay}ms` }}>
			<div className="label mb-4 flex items-center justify-between">
				<span>Items</span>
				<span className="font-mono text-[10px] text-ink">
					{items.length} row{items.length === 1 ? "" : "s"}
				</span>
			</div>
			<div className="border border-rule">
				<div className="grid grid-cols-[28px_1fr_120px] border-b border-rule bg-paper px-3 py-1.5">
					<div className="label">#</div>
					<div className="label">Description</div>
					<div className="label text-right">Quantity</div>
				</div>
				{items.map((it, i) => (
					<div
						key={it.idx}
						className={`grid grid-cols-[28px_1fr_120px] items-center px-3 py-2 font-mono text-[13px] tabular ${
							i < items.length - 1 ? "border-b border-rule-soft" : ""
						}`}
					>
						<div className="text-ink-mute">{it.idx}</div>
						<div className="font-body text-ink">{it.desc}</div>
						<div className="text-right">{it.qty}</div>
					</div>
				))}
			</div>
		</div>
	);
}

/* ── audit row ──────────────────────────────────────────────────────── */
function AuditRow({ entry }: { entry: AuditEntry }) {
	return (
		<li className="grid grid-cols-[12px_140px_1fr_140px_60px] items-center gap-4 py-2.5">
			<span className="dot-edit" aria-hidden="true" />
			<span className="font-mono text-[12px] text-ink">{entry.field}</span>
			<span className="text-[13px] text-ink-mute">
				{entry.before ? (
					<>
						<span className="font-mono text-ink-mute line-through">
							{entry.before}
						</span>
						<span className="mx-2 text-ink-mute">→</span>
						<span className="font-mono text-ink">{entry.after}</span>
					</>
				) : (
					<>
						<span className="text-ink-mute">set to </span>
						<span className="font-mono text-ink">"{entry.after}"</span>
					</>
				)}
			</span>
			<span className="font-mono text-[11px] text-ink-mute">
				{entry.reviewer} · {entry.when}
			</span>
			<button
				type="button"
				className="font-body text-[11px] uppercase tracking-wider text-tag underline-offset-4 hover:underline"
			>
				undo
			</button>
		</li>
	);
}
