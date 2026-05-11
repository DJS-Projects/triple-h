"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RecentUploadStatus } from "@/components/recent-upload-status";
import type { DocumentSummary } from "@/app/openapi-client/types.gen";
import { fetchDocumentList } from "@/lib/api";

// Client-side wrapper around the recent-uploads list. Server renders the
// initial state for SSR; this component takes over after hydration and
// polls the backend so users see live transitions (uploaded → processing
// → extracted/failed) without manually refreshing.
//
// Polling cadence:
//   - Always poll while the tab is visible (cheap: single REST call to
//     /documents?page=1&size=N).
//   - Pauses when the page is hidden via document.visibilityState so a
//     tab left open in the background doesn't burn requests.
//
// Could be tightened further (stop when every row is terminal), but the
// always-poll baseline is correct under every edge case — a new upload
// arriving from another tab still surfaces here.

interface RecentUploadsListProps {
	initial: DocumentSummary[];
	pageSize?: number;
	pollIntervalMs?: number;
}

export function RecentUploadsList({
	initial,
	pageSize = 8,
	pollIntervalMs = 3000,
}: RecentUploadsListProps) {
	const [items, setItems] = useState<DocumentSummary[]>(initial);

	useEffect(() => {
		let cancelled = false;
		let timer: ReturnType<typeof setInterval> | null = null;

		const tick = async () => {
			if (document.visibilityState !== "visible") return;
			const res = await fetchDocumentList(1, pageSize);
			if (cancelled) return;
			if ("error" in res) return;
			setItems(res.items);
		};

		const startInterval = () => {
			if (timer) return;
			timer = setInterval(tick, pollIntervalMs);
		};
		const stopInterval = () => {
			if (timer) clearInterval(timer);
			timer = null;
		};

		// Fire one immediate poll on mount so SSR -> hydration drift gets
		// reconciled within the first tick; otherwise users could see a
		// stale snapshot for up to pollIntervalMs ms.
		void tick();
		startInterval();

		const onVisibility = () => {
			if (document.visibilityState === "visible") {
				void tick();
				startInterval();
			} else {
				stopInterval();
			}
		};
		document.addEventListener("visibilitychange", onVisibility);

		return () => {
			cancelled = true;
			stopInterval();
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [pageSize, pollIntervalMs]);

	if (items.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
				Nothing uploaded yet.
			</p>
		);
	}

	return (
		<ul className="divide-y rounded-md border">
			{items.map((d) => (
				<li key={d.document_id}>
					<Link
						href={`/documents/${d.document_id}`}
						className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate font-medium">{d.filename}</p>
							<div className="flex items-center gap-2">
								{d.doc_type ? (
									<>
										<span className="font-mono text-xs text-muted-foreground">
											{d.doc_type}
										</span>
										<span className="font-mono text-xs text-muted-foreground">
											·
										</span>
									</>
								) : null}
								<RecentUploadStatus status={d.status} />
							</div>
						</div>
						{/* suppressHydrationWarning: toLocaleString() renders
						    in the server's timezone during SSR and the
						    browser's local timezone on the client, which
						    legitimately differ. The client value is what
						    we want; the SSR text is just a placeholder
						    until hydration swaps it in. */}
						<time
							className="font-mono text-xs text-muted-foreground"
							dateTime={d.created_at}
							suppressHydrationWarning
						>
							{new Date(d.created_at).toLocaleString()}
						</time>
					</Link>
				</li>
			))}
		</ul>
	);
}
