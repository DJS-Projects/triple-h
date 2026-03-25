// talent-spectrum-app/src/app/providers/NextAuthSessionProvider.tsx
"use client"; // This directive makes the component a Client Component

import { SessionProvider } from "next-auth/react";
import React from "react";

export function NextAuthSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}