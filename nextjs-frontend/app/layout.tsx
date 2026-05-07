import type { Metadata } from "next";
import { IBM_Plex_Mono, Open_Sans, Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-display",
	display: "swap",
});

const openSans = Open_Sans({
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
	variable: "--font-body",
	display: "swap",
});

const plexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	weight: ["400", "500", "600", "700"],
	variable: "--font-mono",
	display: "swap",
});

export const metadata: Metadata = {
	title: "Heng Hup · Document Extraction",
	description: "Internal tool for verifying extracted business documents.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body
				className={`${rubik.variable} ${openSans.variable} ${plexMono.variable} font-body antialiased`}
			>
				{children}
			</body>
		</html>
	);
}
