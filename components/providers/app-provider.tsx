"use client";

import { SessionProvider } from "next-auth/react";
import { LoadingProvider } from "@/components/providers/loader-context";

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <LoadingProvider>
        {children}
      </LoadingProvider>
    </SessionProvider>
  );
}
