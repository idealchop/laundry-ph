"use client";
import { useId, type CSSProperties } from "react";
import { cn } from "@river-apps/ui";

/**
 * Laundry basket that fills with clothes as the load grows (kit 3D basket art, redrawn so the
 * heap can rise). `fill` is 0 (empty) → 1 (full); each garment slides up from behind the rim at
 * its own threshold, so the stepper reads as a basket getting fuller. Transform-only animation
 * (GPU friendly on phones), disabled for reduced motion.
 */
export function BasketFill({ fill, size = 96, className }: { fill: number; size?: number; className?: string }) {
  const raw = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (n: string) => `bf${raw}${n}`;
  const f = Math.max(0, Math.min(1, Number.isFinite(fill) ? fill : 0));
  /** Progress of one garment between its start/end thresholds, 0..1. */
  const at = (start: number, end: number) => Math.max(0, Math.min(1, (f - start) / (end - start)));
  /** translateY so a garment sits `drop` units below its resting spot (hidden behind the rim) at p = 0. */
  const rise = (p: number, drop: number): CSSProperties => ({ transform: `translateY(${((1 - p) * drop).toFixed(2)}px)` });
  const anim = "transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none";
  const overflow = at(0.92, 1);

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden className={cn("overflow-visible", className)}>
      <defs>
        <linearGradient id={id("sky")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#D5EBFF" /><stop offset=".5" stopColor="#5FA8FF" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
        <linearGradient id={id("lil")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#E7DDFF" /><stop offset=".5" stopColor="#9B7BFF" /><stop offset="1" stopColor="#5B3FD6" /></linearGradient>
        <linearGradient id={id("peach")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFD9BF" /><stop offset=".5" stopColor="#FF8A4C" /><stop offset="1" stopColor="#E4572E" /></linearGradient>
        <linearGradient id={id("mint")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C9F7E1" /><stop offset=".5" stopColor="#34D399" /><stop offset="1" stopColor="#0E9F6E" /></linearGradient>
        <linearGradient id={id("gold")} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFF4B8" /><stop offset=".45" stopColor="#FFC93C" /><stop offset="1" stopColor="#F08C00" /></linearGradient>
        <linearGradient id={id("in")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1E4FB8" /><stop offset="1" stopColor="#3B82F6" /></linearGradient>
        <clipPath id={id("clip")}><rect x="0" y="-12" width="64" height="44" /></clipPath>
        <filter id={id("sh")} x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" floodColor="#0A0A0A" floodOpacity=".22" /></filter>
      </defs>
      <ellipse cx="32" cy="60.5" rx="21" ry="2.2" fill="#0A0A0A" opacity=".07" />
      <g filter={`url(#${id("sh")})`}>
        {/* Back of the opening, visible when the basket is empty. */}
        <path d="M10 28 L12.5 21.8 C12.9 20.9 13.6 20.5 14.6 20.5 L49.4 20.5 C50.4 20.5 51.1 20.9 51.5 21.8 L54 28 Z" fill={`url(#${id("in")})`} opacity=".5" />
        <g clipPath={`url(#${id("clip")})`}>
          {/* Base heap (lilac) */}
          <g className={anim} style={rise(Math.sqrt(at(0, 1)), 16)}>
            <path d="M13 29 C12 20 19 15 26 17 C29 10 40 10 43 17 C49 15 54 21 51 29 Z" fill={`url(#${id("lil")})`} />
            <path d="M19 21 C21.5 18.5 24.5 17.5 27.5 18.2" stroke="#fff" strokeOpacity=".65" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
          {/* Towel (mint), left */}
          <g className={anim} style={rise(at(0.04, 0.5), 14)}>
            <path d="M11 29 C11 23.5 15.5 20.5 20.5 21.5 C24.5 22.3 27 25.5 27.5 29 Z" fill={`url(#${id("mint")})`} />
            <path d="M14.5 24.5 C16 23.2 17.8 22.7 19.5 23" stroke="#fff" strokeOpacity=".6" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </g>
          {/* Shirt (peach), right */}
          <g className={anim} style={rise(at(0.22, 0.8), 14)}>
            <path d="M31 29 C32 22 39 19.5 45 22.5 C49 24.5 51 27 51 29 Z" fill={`url(#${id("peach")})`} />
          </g>
          {/* Sock (gold) on top of the pile */}
          <g className={anim} style={rise(at(0.72, 1), 24)}>
            <path d="M27 13.5 C27.5 9.8 31 8.2 34 9.6 L38.5 11.8 C40.4 12.8 40.6 15.3 38.8 16.4 C37.6 17.1 36.2 16.9 35.2 16.1 L33 14.6 C31.6 15.8 29.3 16.2 27.9 15.4 Z" fill={`url(#${id("gold")})`} />
          </g>
        </g>
        {/* Basket body */}
        <path d="M9.5 32 L54.5 32 L49.6 54.6 C49.1 57 47.6 58.5 45 58.5 L19 58.5 C16.4 58.5 14.9 57 14.4 54.6 Z" fill={`url(#${id("sky")})`} />
        {[15.5, 23.5, 31.5, 39.5, 47.5].map((x) => <rect key={`a${x}`} x={x} y="38.5" width="5" height="4.2" rx="2.1" fill="#fff" opacity=".42" />)}
        {[17.5, 25.5, 33.5, 41.5].map((x) => <rect key={`b${x}`} x={x} y="46.5" width="5" height="4.2" rx="2.1" fill="#fff" opacity=".42" />)}
        <rect x="6" y="26.5" width="52" height="8" rx="4" fill={`url(#${id("sky")})`} />
        <path d="M10.5 29.2 L53.5 29.2" stroke="#fff" strokeOpacity=".7" strokeWidth="2" strokeLinecap="round" />
        {/* Sleeve draped over the rim once the basket is full */}
        <g className="transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: overflow }}>
          <path d="M44 27.5 C47.5 27 50.5 28.4 51.2 31.5 L52.4 37.6 C52.7 39.2 51 40.3 49.7 39.4 L47.3 37.6 L46.6 33 C46.3 31 45.4 30 44 29.8 Z" fill={`url(#${id("peach")})`} />
        </g>
      </g>
    </svg>
  );
}

/** Short words for how full the basket is. */
export function basketLabel(fill: number, belowMinimum: boolean): string {
  if (fill <= 0) return "Empty basket";
  if (belowMinimum) return "Light load · under minimum";
  if (fill < 0.45) return "Light load";
  if (fill < 0.7) return "Half basket";
  if (fill < 1) return "Almost full";
  return "Full basket";
}
