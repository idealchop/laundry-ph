import { HOW_IT_WORKS } from "@/lib/shop-qr";

/** Short explanation of the single shop QR, on the owner QR page. */
export function HowBookingWorks({ className = "" }: { className?: string }) {
  return (
    <section className={className} aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-[16px] font-extrabold tracking-[-0.02em]">How it works</h2>
      <ol className="mt-3 flex flex-col gap-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex size-7 flex-none items-center justify-center rounded-full bg-ink text-[13px] font-bold text-on-ink" aria-hidden>{i + 1}</span>
            <p className="pt-0.5 text-[14px] font-medium leading-snug text-ink-2">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
