"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteDocument } from "@/lib/api";

interface DeleteDocumentButtonProps {
	documentId: string;
	filename: string;
}

export function DeleteDocumentButton({
	documentId,
	filename,
}: DeleteDocumentButtonProps) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();

	const onClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		if (
			!window.confirm(
				`Delete "${filename}"? This removes the file, all extraction runs, and the audit history. This cannot be undone.`,
			)
		)
			return;
		startTransition(async () => {
			const result = await deleteDocument(documentId);
			if ("error" in result) {
				window.alert(`Delete failed: ${result.error}`);
				return;
			}
			router.refresh();
		});
	};

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={pending}
			className="rounded-sm border border-transparent px-2 py-0.5 text-[11px] text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
			title={`Delete ${filename}`}
		>
			{pending ? "Deleting…" : "Delete"}
		</button>
	);
}
