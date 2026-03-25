// talent-spectrum-app/src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers"; // Assuming this is also a client component or contains client components
import PageWrapper from "./PageWrapper"; // client wrapper

// --- LOGIC ADDITION: Import the new client-side SessionProvider wrapper ---
import { NextAuthSessionProvider } from "./providers/NextAuthSessionProvider";
// --- END LOGIC ADDITION ---

// Initialize Geist fonts as per your original code
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Heng Hup Holdings - AI Powered Platform",
  description:
    "A platform that leverages AI to enhance business operations and decision-making.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        {/* Wrap with the new client-side SessionProvider wrapper */}
        <NextAuthSessionProvider>
          <Providers>
            <PageWrapper>{children}</PageWrapper>
          </Providers>
        </NextAuthSessionProvider>
      </body>
    </html>
  );
}