import Link from "next/link";
import { ExtractionQueue } from "@/components/extraction-queue";
import { RecentUploadsList } from "@/components/recent-uploads-list";
import { fetchDocumentList } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
	const recent = await fetchDocumentList(1, 8);
	const items = "error" in recent ? [] : recent.items;

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-10 px-6 py-12">
			<header className="flex flex-col gap-2">
				<p className="font-mono text-xs uppercase tracking-[0.18em] text-brand-blue">
					Document Extraction
				</p>
				<h1 className="font-display text-4xl font-semibold tracking-tight text-brand-navy">
					Upload a document
				</h1>
				<p className="max-w-xl text-sm text-muted-foreground">
					Drop a PDF to run OCR + structured extraction. Document type is
					auto-classified — override only if the model is wrong.
				</p>
			</header>

			<ExtractionQueue />

			<section className="flex flex-col gap-3">
				<div className="flex items-end justify-between">
					<h2 className="font-display text-lg font-semibold">
						Recent uploads
					</h2>
					<Link
						href="/documents"
						className="text-sm text-muted-foreground hover:text-foreground"
					>
						View all →
					</Link>
				</div>

				<RecentUploadsList initial={items} />
			</section>
		</main>
	);
}
