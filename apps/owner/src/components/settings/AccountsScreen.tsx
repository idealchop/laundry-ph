"use client";

import { FocusHeader } from "@/components/FocusHeader";
import { CreditsPanel } from "./CreditsPanel";

/** @deprecated Credits live under Profile; kept for FocusSurface demos. Prefer CreditsPanel. */
export function AccountsScreen() {
  return (
    <>
      <FocusHeader title="Credits" backHref="/profile" />
      <CreditsPanel />
    </>
  );
}
