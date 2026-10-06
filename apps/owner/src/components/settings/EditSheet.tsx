"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Bottom sheet on phones, small centred modal from `sm` up. Escape / backdrop close, body scroll locked,
 * focus moves into the sheet and back to the opener on close.
 */
export function EditSheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLElement>("input, button:not([data-close])")?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label="Close" tabIndex={-1} data-close className="absolute inset-0 bg-black/40 motion-safe:animate-[fadeIn_.15s_ease-out]" onClick={onClose} />
      <div ref={panel}
        className="relative z-[1] flex max-h-[88dvh] w-full max-w-[440px] flex-col rounded-t-[28px] bg-surface shadow-card motion-safe:animate-[sheetUp_.22s_cubic-bezier(.2,.8,.2,1)] sm:rounded-[24px]">
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-grey-200 sm:hidden" />
        <div className="flex flex-none items-center justify-between gap-3 px-5 pb-1 pt-3 sm:pt-5">
          <h2 id={titleId} className="min-w-0 truncate text-[18px] font-extrabold tracking-[-0.02em]">{title}</h2>
          <button type="button" data-close onClick={onClose} aria-label="Close"
            className="-mr-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-muted hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink">
            <X size={20} strokeWidth={1.9} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2 pt-2">{children}</div>
        {footer ? <div className="flex-none px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Even-width segmented choice that fits four short labels on a 390px phone. */
export function Segmented<T extends string>({ label, options, value, onChange, disabled }: {
  label: string; options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-[14px] bg-grey-100 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} disabled={disabled} onClick={() => onChange(o.value)}
            className={`min-h-11 rounded-[10px] px-1 text-[12.5px] font-bold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-ink disabled:opacity-50 ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(0,0,0,.1)]" : "text-muted hover:text-ink"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Small on/off switch (44px tap target). */
export function Toggle({ on, label, disabled, onChange }: { on: boolean; label: string; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className="group inline-flex h-11 w-12 flex-none items-center justify-center focus-visible:outline-none disabled:cursor-not-allowed">
      <span className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink group-disabled:opacity-50 ${on ? "bg-ink" : "bg-grey-300"}`}>
        <span aria-hidden className={`absolute size-[18px] rounded-full bg-white shadow transition-transform ${on ? "translate-x-[19px]" : "translate-x-[3px]"}`} />
      </span>
    </button>
  );
}
