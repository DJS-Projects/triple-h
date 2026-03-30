import { Files, FileText } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
	return (
		<div className="py-12 text-center">
			<h1 className="mb-3 text-3xl font-bold">Document Extractor</h1>
			<p className="mb-10 text-gray-500">
				Upload PDFs to extract structured data using AI-powered OCR.
			</p>

			<div className="mx-auto grid max-w-2xl gap-6 sm:grid-cols-2">
				<Link
					href="/delivery-orders"
					className="group rounded-xl border bg-white p-6 text-left shadow-sm transition hover:shadow-md"
				>
					<FileText className="mb-3 h-8 w-8 text-blue-600" />
					<h2 className="mb-1 font-semibold group-hover:text-blue-700">Delivery Orders</h2>
					<p className="text-sm text-gray-500">
						Quick upload for delivery order PDFs. Auto-detects and extracts fields.
					</p>
				</Link>

				<Link
					href="/documents"
					className="group rounded-xl border bg-white p-6 text-left shadow-sm transition hover:shadow-md"
				>
					<Files className="mb-3 h-8 w-8 text-blue-600" />
					<h2 className="mb-1 font-semibold group-hover:text-blue-700">Mixed Documents</h2>
					<p className="text-sm text-gray-500">
						Process delivery orders, invoices, and weighing bills with model selection.
					</p>
				</Link>
			</div>
		</div>
	);
}
