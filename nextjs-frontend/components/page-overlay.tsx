"use client";

import { useEffect, useState } from "react";

export interface BlockOverlay {
	block_id: string;
	block_type: string;
	text: string;
	quad: [number, number][];
	bbox: [number, number, number, number];
}

export interface PageBlocks {
	page_no: number;
	width_px: number;
	height_px: number;
	blocks: BlockOverlay[];
	field_anchors: Record<string, string>;
}

const TYPE_COLOR: Record<string, string> = {
	Text: "rgba(52, 132, 197, 0.55)",
	SectionHeader: "rgba(197, 60, 52, 0.65)",
	Table: "rgba(52, 168, 83, 0.6)",
	Picture: "rgba(170, 100, 30, 0.6)",
	Caption: "rgba(140, 90, 180, 0.55)",
	Footnote: "rgba(110, 110, 110, 0.4)",
	Formula: "rgba(200, 60, 130, 0.55)",
};

interface PageOverlayProps {
	imageSrc: string;
	pageBlocks: PageBlocks | null;
	highlightedBlockId: string | null;
	onHoverBlock: (blockId: string | null) => void;
	scale: number;
}

export function PageOverlay({
	imageSrc,
	pageBlocks,
	highlightedBlockId,
	onHoverBlock,
	scale,
}: PageOverlayProps) {
	const [overlayVisible, setOverlayVisible] = useState(true);
	const [opacity, setOpacity] = useState(0.4);

	const w = pageBlocks?.width_px ?? 1;
	const h = pageBlocks?.height_px ?? 1;

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			<div className="flex flex-wrap items-center gap-3 text-xs">
				<label className="flex items-center gap-2">
					<input
						type="checkbox"
						checked={overlayVisible}
						onChange={(e) => setOverlayVisible(e.target.checked)}
					/>
					<span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
						Overlay
					</span>
				</label>
				<label className="flex items-center gap-2">
					<span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
						Opacity
					</span>
					<input
						type="range"
						min={0}
						max={1}
						step={0.05}
						value={opacity}
						onChange={(e) => setOpacity(Number(e.target.value))}
						className="mx-2 w-24 accent-brand-deep"
					/>
				</label>
				<span className="ml-auto font-mono text-muted-foreground">
					{pageBlocks ? `${pageBlocks.blocks.length} blocks` : "—"}
				</span>
			</div>

			{/* Vertical-fit: image always fits within parent height, letterboxes
			    horizontally if narrower. SVG uses preserveAspectRatio=meet so the
			    overlay coords stay aligned with the painted image area. */}
			<div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/30">
				{/* biome-ignore lint/performance/noImgElement: dynamic upstream proxy */}
				<img
					src={imageSrc}
					alt="Document page"
					width={w}
					height={h}
					className="max-h-full max-w-full select-none object-contain"
					draggable={false}
				/>

				{overlayVisible && pageBlocks ? (
					<svg
						viewBox={`0 0 ${w} ${h}`}
						preserveAspectRatio="xMidYMid meet"
						className="pointer-events-none absolute inset-0 h-full w-full"
						style={{
							transform: `scale(${scale})`,
							transformOrigin: "center center",
						}}
					>
						<g className="pointer-events-auto">
						{pageBlocks.blocks.map((b) => {
							const isOn = highlightedBlockId === b.block_id;
							const fill =
								TYPE_COLOR[b.block_type] ?? "rgba(60, 60, 60, 0.4)";
							const strokeOpacity = isOn ? 1 : opacity;
							const fillOpacity = isOn ? 0.6 : opacity * 0.45;
							return (
								<polygon
									key={b.block_id}
									points={b.quad
										.map((p) => `${p[0]},${p[1]}`)
										.join(" ")}
									fill={fill}
									fillOpacity={fillOpacity}
									stroke={fill}
									strokeWidth={isOn ? 4 : 2}
									strokeOpacity={strokeOpacity}
									className="cursor-pointer transition-[fill-opacity,stroke-width,stroke-opacity] duration-150"
									onMouseEnter={() => onHoverBlock(b.block_id)}
									onMouseLeave={() => onHoverBlock(null)}
								>
									<title>{`${b.block_type}: ${b.text.slice(0, 200)}`}</title>
								</polygon>
							);
						})}
						</g>
					</svg>
				) : null}
			</div>
		</div>
	);
}

interface ScaleSliderProps {
	scale: number;
	onChange: (v: number) => void;
}

export function ScaleSlider({ scale, onChange }: ScaleSliderProps) {
	return (
		<label className="flex items-center gap-2 text-xs">
			<span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
				Scale
			</span>
			<input
				type="range"
				min={0.85}
				max={1.15}
				step={0.005}
				value={scale}
				onChange={(e) => onChange(Number(e.target.value))}
				className="mx-2 w-32 accent-brand-deep"
			/>
			<span className="font-mono tabular-nums text-muted-foreground">
				{scale.toFixed(3)}×
			</span>
			<button
				type="button"
				onClick={() => onChange(1)}
				className="rounded-sm border bg-card px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute hover:bg-muted"
			>
				Reset
			</button>
		</label>
	);
}

export function usePageBlocks(documentId: string, pageNo: number) {
	const [data, setData] = useState<PageBlocks | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const ctrl = new AbortController();
		setData(null);
		setError(null);
		fetch(`/api/documents/${documentId}/pages/${pageNo}/blocks`, {
			signal: ctrl.signal,
		})
			.then(async (r) => {
				if (!r.ok) throw new Error(`upstream ${r.status}`);
				return (await r.json()) as PageBlocks;
			})
			.then(setData)
			.catch((e) => {
				if (ctrl.signal.aborted) return;
				setError(e instanceof Error ? e.message : "fetch failed");
			});
		return () => ctrl.abort();
	}, [documentId, pageNo]);

	return { data, error };
}
