import { Icon3D, type IconName } from "@river-apps/icons";
import type { ReactNode } from "react";

/** Calm empty state: 3D icon on a soft backdrop, one line, an optional quiet action. */
export function EmptyQueue({ title, subtitle, icon = "basket", action, className = "" }: { title: string; subtitle?: string; icon?: IconName; action?: ReactNode; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-card bg-gradient-to-b from-grey-50 to-surface px-5 py-7 text-center ring-1 ring-line ${className}`}>
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-2 size-36 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(10,10,10,0.06),transparent)]" />
      <Icon3D name={icon} size={72} className="relative mx-auto drop-shadow-[0_8px_12px_rgba(0,0,0,0.12)]" />
      <b className="relative mt-3 block text-[16px] tracking-[-0.01em]">{title}</b>
      {subtitle ? <p className="relative mt-1 text-[13px] font-medium text-muted">{subtitle}</p> : null}
      {action ? <div className="relative mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
