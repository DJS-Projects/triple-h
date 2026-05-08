import Link from "next/link";
import { DeleteDocumentButton } from "@/components/delete-document-button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { fetchDocumentList } from "@/lib/api";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 20;

function clampPageSize(raw: string | undefined): number {
	const n = Number(raw);
	if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
	return PAGE_SIZES.includes(n as (typeof PAGE_SIZES)[number])
		? n
		: DEFAULT_PAGE_SIZE;
}

export default async function DocumentsListPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; size?: string }>;
}) {
	const sp = await searchParams;
	const page = Math.max(1, Number(sp.page ?? 1) || 1);
	const size = clampPageSize(sp.size);
	const result = await fetchDocumentList(page, size);

	if ("error" in result) {
		return (
			<main className="mx-auto max-w-5xl px-6 py-12">
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{result.error}
				</p>
			</main>
		);
	}

	const totalPages = result.pages ?? 1;
	const total = result.total ?? result.items.length;
	const hasPrev = page > 1;
	const hasNext = page < totalPages;
	const buildHref = (p: number, s: number = size) =>
		`/documents?page=${p}&size=${s}`;

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
			<header className="flex items-end justify-between border-b pb-6">
				<div>
					<p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-blue">
						Library
					</p>
					<h1 className="font-display text-3xl font-semibold tracking-tight text-brand-navy">
						All uploads
					</h1>
				</div>
				<Link
					href="/"
					className="text-sm text-muted-foreground hover:text-brand-deep"
				>
					← Upload new
				</Link>
			</header>

			{result.items.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
					No documents yet.
				</p>
			) : (
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Filename</TableHead>
							<TableHead className="w-[10rem]">Type</TableHead>
							<TableHead className="w-[6rem]">Status</TableHead>
							<TableHead className="w-[5rem]">Pages</TableHead>
							<TableHead className="w-[12rem]">Uploaded</TableHead>
							<TableHead className="w-[5rem]" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{result.items.map((d) => (
							<TableRow key={d.document_id}>
								<TableCell>
									<Link
										href={`/documents/${d.document_id}`}
										className="block truncate font-medium hover:underline"
									>
										{d.filename}
									</Link>
								</TableCell>
								<TableCell className="font-mono text-xs">
									{d.doc_type ?? "—"}
								</TableCell>
								<TableCell className="font-mono text-xs">
									{d.status}
								</TableCell>
								<TableCell className="font-mono text-xs">
									{d.page_count ?? "—"}
								</TableCell>
								<TableCell
									className="font-mono text-xs text-muted-foreground"
									suppressHydrationWarning
								>
									{new Date(d.created_at).toLocaleString()}
								</TableCell>
								<TableCell className="text-right">
									<DeleteDocumentButton
										documentId={d.document_id}
										filename={d.filename}
									/>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			<nav className="flex flex-wrap items-center justify-between gap-3 border-t pt-4 font-mono text-xs">
				<div className="flex items-center gap-3 text-muted-foreground">
					<span>
						{total === 0
							? "0 documents"
							: `${total} document${total === 1 ? "" : "s"} · page ${page} of ${totalPages}`}
					</span>
					<form className="flex items-center gap-2">
						<label className="flex items-center gap-1.5">
							<span>Per page</span>
							{/* Plain link list — keeps the page server-rendered, no JS needed. */}
						</label>
						<div className="flex gap-1">
							{PAGE_SIZES.map((s) => (
								<Link
									key={s}
									href={buildHref(1, s)}
									className={`rounded-md border px-2 py-0.5 ${
										s === size
											? "border-brand-deep bg-brand-deep text-white"
											: "hover:bg-muted"
									}`}
								>
									{s}
								</Link>
							))}
						</div>
					</form>
				</div>
				<div className="flex items-center gap-2">
					{hasPrev ? (
						<Link
							href={buildHref(page - 1)}
							className="rounded-md border px-3 py-1 hover:bg-muted"
						>
							← Prev
						</Link>
					) : (
						<span className="cursor-not-allowed rounded-md border px-3 py-1 text-muted-foreground/50">
							← Prev
						</span>
					)}
					{hasNext ? (
						<Link
							href={buildHref(page + 1)}
							className="rounded-md border px-3 py-1 hover:bg-muted"
						>
							Next →
						</Link>
					) : (
						<span className="cursor-not-allowed rounded-md border px-3 py-1 text-muted-foreground/50">
							Next →
						</span>
					)}
				</div>
			</nav>
		</main>
	);
}
