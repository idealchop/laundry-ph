"use client";
import { useEffect, useRef } from "react";

/**
 * Poll `fn` every `ms` only while the tab is visible (river-ai-rules: no always-on polling).
 * Runs once on mount and again when the tab becomes visible. Pass enabled=false to stop (e.g. terminal status).
 */
export function useVisiblePoll(fn: () => void | Promise<void>, ms: number, enabled = true) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }, [fn]);
  useEffect(() => {
    if (!enabled) return;
    let timer: number | undefined;
    const tick = () => { void ref.current(); };
    const start = () => { if (timer === undefined) { tick(); timer = window.setInterval(tick, ms); } };
    const stop = () => { if (timer !== undefined) { window.clearInterval(timer); timer = undefined; } };
    const onVis = () => (document.visibilityState === "visible" ? start() : stop());
    queueMicrotask(onVis);
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [ms, enabled]);
}
