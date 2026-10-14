/**
 * Companion mark: a bold, round-capped smile (from the River smile) with a four-point spark.
 * Black, no background. "idle" breathes, "thinking" waves + twinkles, "still" for inline use.
 * Animations live in globals.css and stop under prefers-reduced-motion.
 */
export function CompanionMark({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden fill="none">
      <path className="cm-smile" d="M4.8 14.2C8 21.8 12.8 24.4 16.3 24.4c3.7 0 7.6-2.5 10.4-8" stroke="currentColor" strokeWidth="3.8" strokeLinecap="round" />
      <path className="cm-spark" d="M24.6 3.2c.5 2.8 1.35 3.65 4.1 4.1-2.75.45-3.6 1.3-4.1 4.1-.45-2.8-1.3-3.65-4.1-4.1 2.8-.45 3.65-1.3 4.1-4.1Z" fill="currentColor" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

export function CompanionAvatar({ size = 36, state = "idle" }: { size?: number; state?: "idle" | "thinking" | "still" }) {
  return (
    <span aria-hidden className={`companion-face companion-${state} inline-flex flex-none items-center justify-center text-ink`} style={{ width: size, height: size }}>
      <CompanionMark size={size} />
    </span>
  );
}
