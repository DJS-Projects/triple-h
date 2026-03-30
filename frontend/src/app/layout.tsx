import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Heng Hup Holdings — Document Extractor",
	description: "AI-powered document extraction for delivery orders, invoices, and weighing bills",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body className={`${geist.className} bg-gray-50 text-gray-900 antialiased`}>
				<header className="border-b bg-white">
					<nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
						<Link href="/" className="text-lg font-bold text-blue-700">
							Heng Hup Holdings
						</Link>
						<div className="flex gap-6 text-sm">
							<Link href="/delivery-orders" className="text-gray-600 hover:text-gray-900">
								Delivery Orders
							</Link>
							<Link href="/documents" className="text-gray-600 hover:text-gray-900">
								Mixed Documents
							</Link>
						</div>
					</nav>
				</header>
				<main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
			</body>
		</html>
	);
}
