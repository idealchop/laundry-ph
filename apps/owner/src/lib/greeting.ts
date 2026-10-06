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
