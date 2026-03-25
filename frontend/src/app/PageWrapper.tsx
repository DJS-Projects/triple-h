"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Header from "@/app/components/header";
import Footer from "@/app/components/footer";

export default function PageWrapper({ children }: { children: React.ReactNode }) {
  const [currentPage, setCurrentPage] = useState("home");
  const pathname = usePathname();

  // Routes where the footer should NOT appear
  const noFooterRoutes = ["/login", "/register"];

  // Determine whether to show the footer
  const shouldShowFooter = !noFooterRoutes.includes(pathname);

  return (
    <div className="min-h-screen flex flex-col">
      <Header setCurrentPage={setCurrentPage} />
      <main className="flex-1">{children}</main>

      {shouldShowFooter && <Footer setCurrentPage={setCurrentPage} />}
    </div>
  );
}
