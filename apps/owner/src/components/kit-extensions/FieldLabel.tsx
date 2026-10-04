import type { ReactNode } from "react";
import { cn } from "@river-apps/ui";

/** Bold field label with an optional grey note on the right ("Min. 5 kg", "Optional"). */
export function FieldLabel({ children, aside, id, className }: { children: ReactNode; aside?: ReactNode; id?: string; className?: string }) {
  return (
    <div className={cn("mb-2 flex items-baseline justify-between gap-3", className)}>
      <span id={id} className="text-[14px] font-bold">{children}</span>
      {aside ? <span className="text-[12.5px] font-semibold text-muted">{aside}</span> : null}
    </div>
  );
}
