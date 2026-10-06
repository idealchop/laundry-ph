"use client";
import { useSyncExternalStore } from "react";

/** "Good morning" before 12:00, "Good afternoon" before 18:00, else "Good evening" — Asia/Manila time. */
export function greetingFor(date: Date): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Manila" }).format(date));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

const subscribe = (notify: () => void) => {
  const id = window.setInterval(notify, 60_000);
  return () => window.clearInterval(id);
};

/**
 * Time-of-day greeting that is safe for statically rendered pages: the server/prerender snapshot is
 * an empty string (nothing to mismatch), the client fills it in and re-checks every minute.
 */
export function useGreeting(): string {
  return useSyncExternalStore(subscribe, () => greetingFor(new Date()), () => "");
}

/** Placeholder names that mean "we don't know the owner's name" (createShop falls back to "Owner"). */
const NO_NAME = new Set(["", "owner"]);

/** Owner's first name for greetings, or "" when unknown. Never returns stray spaces or punctuation. */
export function ownerFirstName(name?: string | null): string {
  const first = (name ?? "").trim().split(/\s+/)[0]?.replace(/[,.;:]+$/, "") ?? "";
  return NO_NAME.has(first.toLowerCase()) ? "" : first;
}

/**
 * Desktop home title: "Hi Liza, here’s today" with a first name; otherwise the phone hero's
 * "Good afternoon, Bea’s Wash" (or "Here’s today" before the client knows the time of day).
 */
export function homeTitle(ownerName: string | null | undefined, shopName: string, greeting: string): string {
  const first = ownerFirstName(ownerName);
  if (first) return `Hi ${first}, here’s today`;
  const shop = shopName.trim();
  if (greeting && shop) return `${greeting}, ${shop}`;
  return greeting || "Here’s today";
}
