"use client";

import type { ReactNode } from "react";
import { AuthGateProvider } from "@/components/auth/AuthGateProvider";
import { AuthProvider } from "@/lib/auth";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AuthGateProvider>{children}</AuthGateProvider>
    </AuthProvider>
  );
}
