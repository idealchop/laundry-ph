"use client";

import dynamic from "next/dynamic";

/** The booking form reads the shop from the URL and writes a local booking. Skip SSR so the page doesn't hydrate against a different tree. */
export const BookClient = dynamic(() => import("./BookScreen").then((m) => m.BookScreen), {
  ssr: false,
  loading: () => <main className="px-6 py-12 text-[14px] font-semibold text-muted">Loading the booking page…</main>,
});
