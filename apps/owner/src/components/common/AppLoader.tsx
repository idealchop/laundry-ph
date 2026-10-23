import { LEFTCORNER_PATH, RIGHTCORNER_PATH, SMILE_PATH, UNDERLINE_PATH } from "@/components/shell/river-logo-paths";

const PATHS = [SMILE_PATH, UNDERLINE_PATH, LEFTCORNER_PATH, RIGHTCORNER_PATH];
const W = 46, H = Math.round(W * 256 / 472);

function RiverSmile({ color }: { color: string }) {
  return (
    <svg viewBox="-10 -6 472 256" fill={color} aria-hidden className="block" style={{ width: W, height: H }}>
      {PATHS.map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/**
 * The one loading screen (Barbers.ph parity): the River mark only, solid black, centred, faded,
 * with a soft shine sweeping across it. Reduced motion: just the faded mark.
 * Screens with cached data render content at once and never show this.
 */
export function AppLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="fixed inset-0 z-[5] flex items-center justify-center bg-canvas">
      <span className="sr-only">{label}…</span>
      <span aria-hidden className="relative inline-block opacity-40">
        <RiverSmile color="#000" />
        <span className="app-loader-shine absolute inset-0"><RiverSmile color="#fff" /></span>
      </span>
    </div>
  );
}
