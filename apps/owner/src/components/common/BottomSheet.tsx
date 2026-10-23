"use client";
import { X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Bottom sheet (Barbers.ph parity): title, optional subtitle, scrolling body; `tall` for long lists. */
export function BottomSheet({ title, subtitle, onClose, tall, children }: { title: string; subtitle?: string; onClose: () => void; tall?: boolean; children: ReactNode }) {
  const id = useId();
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = prev; };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby={id}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-ink/45" onClick={onClose} />
      <div className={`relative z-[1] flex w-full max-w-[460px] flex-col rounded-t-[28px] bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-card sm:rounded-[28px] ${tall ? "h-[82vh]" : "max-h-[82vh]"}`}>
        <div className="flex items-start gap-3 px-5 pb-2 pt-5">
          <div className="min-w-0 flex-1">
            <h2 id={id} className="text-[20px] font-extrabold tracking-[-0.02em]">{title}</h2>
            {subtitle ? <p className="text-[13px] font-semibold text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-9 flex-none items-center justify-center rounded-full bg-grey-100"><X size={18} aria-hidden /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
