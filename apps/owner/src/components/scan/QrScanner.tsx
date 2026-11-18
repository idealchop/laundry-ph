"use client";
import { useEffect, useRef, useState } from "react";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/**
 * Live camera QR scanner (Barbers.ph pattern). Native BarcodeDetector when present, else jsQR on canvas
 * frames (iOS Safari: playsinline + muted + rear camera, HTTPS only). Clean frame: four white corners.
 */
export function QrScanner({ onResult, paused = false, className }: { onResult: (text: string) => void; paused?: boolean; className?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const cb = useRef(onResult);
  useEffect(() => { cb.current = onResult; }, [onResult]);
  const [state, setState] = useState<"starting" | "on" | "denied" | "unavailable">("starting");

  useEffect(() => {
    if (paused) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let live = true;
    let last = "";
    let lastAt = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setState("unavailable"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      } catch (e) {
        if (!live) return;
        const name = (e as DOMException)?.name;
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
        return;
      }
      if (!live || !video.current) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = video.current;
      v.srcObject = stream;
      v.setAttribute("playsinline", "true");
      v.muted = true;
      await v.play().catch(() => undefined);
      setState("on");
      let detector: Detector | null = null;
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      if (BD) { try { detector = new BD({ formats: ["qr_code"] }); } catch { detector = null; } }
      const jsQR = detector ? null : (await import("jsqr")).default;
      let busy = false;
      const tick = async () => {
        if (!live) return;
        raf = requestAnimationFrame(() => void tick());
        if (busy || v.readyState < 2 || !v.videoWidth) return;
        busy = true;
        try {
          let text = "";
          if (detector) {
            text = (await detector.detect(v))[0]?.rawValue ?? "";
          } else if (jsQR && ctx) {
            const scale = Math.min(1, 640 / v.videoWidth);
            canvas.width = Math.round(v.videoWidth * scale);
            canvas.height = Math.round(v.videoHeight * scale);
            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data ?? "";
          }
          const now = Date.now();
          if (text && (text !== last || now - lastAt > 2500)) { last = text; lastAt = now; navigator.vibrate?.(40); cb.current(text); }
        } catch { /* keep scanning */ } finally { busy = false; }
      };
      void tick();
    })();
    return () => { live = false; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [paused]);

  const corner = "absolute size-11 border-white";
  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-[28px] bg-ink ${className ?? ""}`}>
      <video ref={video} playsInline muted autoPlay className="absolute inset-0 size-full object-cover" aria-label="Camera view for scanning a ticket QR" />
      <div aria-hidden className="pointer-events-none absolute inset-[18%]">
        <span className={`${corner} left-0 top-0 rounded-tl-[18px] border-l-4 border-t-4`} />
        <span className={`${corner} right-0 top-0 rounded-tr-[18px] border-r-4 border-t-4`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-[18px] border-b-4 border-l-4`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-[18px] border-b-4 border-r-4`} />
      </div>
      {paused || state !== "on" ? (
        <div className="absolute inset-0 flex items-center justify-center px-10 text-center text-[14px] font-semibold text-white/80" role="status">
          {paused ? "Paused" : state === "starting" ? "Starting camera…" : state === "denied" ? "Camera is off. Allow it in your browser, or type the code." : "No camera here. Type the code below."}
        </div>
      ) : null}
    </div>
  );
}
