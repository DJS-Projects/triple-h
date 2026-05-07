import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewClient } from "@/app/documents/[id]/ReviewClient";
import { fetchDocumentDetail } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function DocumentReviewPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const detail = await fetchDocumentDetail(id);

	if ("error" in detail) {
		if (detail.error.toLowerCase().includes("not found")) notFound();
		return (
			<main className="mx-auto max-w-5xl px-6 py-12">
				<p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{detail.error}
				</p>
				<Link
					href="/"
					className="mt-4 inline-block text-sm text-muted-foreground hover:text-foreground"
				>
					← Back to upload
				</Link>
			</main>
		);
	}

	return <ReviewClient detail={detail} />;
}
