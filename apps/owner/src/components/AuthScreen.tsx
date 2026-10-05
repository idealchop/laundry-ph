import { cn } from "@river-apps/ui";
import type { ReactNode } from "react";

/** Mobile-first auth column (welcome / phone / code), matching Mycarwash. */
export function AuthScreen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-surface sm:bg-canvas">
      <div
        className={cn(
          "relative mx-auto flex min-h-dvh w-full max-w-[440px] flex-col pt-3 bg-surface sm:my-6 sm:min-h-[calc(100dvh-48px)] sm:rounded-device sm:shadow-card",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AuthBadge({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex size-[88px] items-center justify-center rounded-[28px] bg-grey-100">
      {children}
      <i aria-hidden className="absolute -right-1.5 top-1.5 size-4 rounded-full border-2 border-white/90 bg-white/35" />
      <i aria-hidden className="absolute -right-3.5 top-[26px] size-2.5 rounded-full border-2 border-white/90 bg-white/35" />
    </div>
  );
}
