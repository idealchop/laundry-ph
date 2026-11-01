import { ChevronLeft, X } from "lucide-react";
import { cn } from "@river-apps/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { SampleNote } from "./SampleNote";

/** Top bar for full-screen tasks: round back/close link, optional centred title (+ sample tag), optional trailing slot. */
export function FocusHeader({ title, backHref, variant = "back", trailing }: { title?: string; backHref: string; variant?: "back" | "close"; trailing?: ReactNode }) {
  return (
    <div className="flex min-h-14 flex-none items-center justify-between gap-1 px-4 pt-2">
      <Link
        href={backHref}
        aria-label={variant === "close" ? "Close" : "Back"}
        className="inline-flex size-11 flex-none items-center justify-center rounded-full text-ink transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {variant === "close" ? <X size={22} strokeWidth={1.75} /> : <ChevronLeft size={22} strokeWidth={1.75} />}
      </Link>
      <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
        {title ? <span className="truncate text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em]">{title}</span> : null}
        <SampleNote className={title ? "mt-0.5" : undefined} />
      </span>
      {trailing ?? null}
    </div>
  );
}

/** Surface for focus routes: full-screen on phones, a centred card next to the sidebar on desktop. */
export function FocusSurface({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn("relative mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-surface lg:my-8 lg:min-h-[calc(100dvh-4rem)] lg:overflow-hidden lg:rounded-banner lg:shadow-card", className)}
      style={style}
    >
      {children}
    </div>
  );
}
