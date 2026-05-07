import Link from "next/link";
import { fetchDocumentList } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DocumentsListPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string }>;
}) {
	const sp = await searchParams;
	const page = Number(sp.page ?? 1);
	const result = await fetchDocumentList(page, 50);

	if ("error" in result) {
		return (
			<main className="mx-auto max-w-5xl px-6 py-12">
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{result.error}
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12">
			<header className="flex items-end justify-between">
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
				<table className="w-full text-sm">
					<thead className="border-b text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">
						<tr>
							<th className="py-2 pr-4 font-medium">Filename</th>
							<th className="py-2 pr-4 font-medium">Type</th>
							<th className="py-2 pr-4 font-medium">Status</th>
							<th className="py-2 pr-4 font-medium">Pages</th>
							<th className="py-2 font-medium">Uploaded</th>
						</tr>
					</thead>
					<tbody className="divide-y">
						{result.items.map((d) => (
							<tr key={d.document_id} className="hover:bg-muted/40">
								<td className="py-2 pr-4">
									<Link
										href={`/documents/${d.document_id}`}
										className="block truncate font-medium hover:underline"
									>
										{d.filename}
									</Link>
								</td>
								<td className="py-2 pr-4 font-mono text-xs">
									{d.doc_type ?? "—"}
								</td>
								<td className="py-2 pr-4 font-mono text-xs">{d.status}</td>
								<td className="py-2 pr-4 font-mono text-xs">
									{d.page_count ?? "—"}
								</td>
								<td className="py-2 font-mono text-xs text-muted-foreground">
									{new Date(d.created_at).toLocaleString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}

			{result.pages && result.pages > 1 ? (
				<nav className="flex items-center justify-between font-mono text-xs">
					<span className="text-muted-foreground">
						Page {result.page} of {result.pages} · {result.total} total
					</span>
					<div className="flex gap-2">
						{page > 1 ? (
							<Link
								href={`/documents?page=${page - 1}`}
								className="rounded-md border px-3 py-1 hover:bg-muted"
							>
								Prev
							</Link>
						) : null}
						{page < result.pages ? (
							<Link
								href={`/documents?page=${page + 1}`}
								className="rounded-md border px-3 py-1 hover:bg-muted"
							>
								Next
							</Link>
						) : null}
					</div>
				</nav>
			) : null}
		</main>
	);
}
