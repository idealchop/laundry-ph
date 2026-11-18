"use client";

/**
 * Plan selection + payment UX.
 * PayMongo keys are not wired yet — checkout shows prices and a clear demo/test upgrade
 * that writes shops/{id}.tier in Firestore. Stub webhook lives at /api/billing/webhook.
 */
import { useState } from "react";
import { Topbar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { PLAN_OPTIONS, monthlyExpiryFrom, type PlanOptionId, isLifetimeOption } from "@/lib/plans";
import { useAuthGatePrompt } from "@/components/auth/AuthGateProvider";
import { useAction, useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";

export function BillingScreen() {
  useAuthGatePrompt({ promptOnMount: true, subtitle: "Sign in to choose a plan and unlock Pro features." });
  const { shop, member, source, reload } = useShop();
  const { busy, error, run, setError } = useAction();
  const [note, setNote] = useState<string | null>(null);
  const readOnlySample = shop.sample === true && source.mode === "firebase";
  const canManage = member.role === "owner" && !readOnlySample;

  async function choose(id: PlanOptionId) {
    setNote(null);
    setError(null);
    const opt = PLAN_OPTIONS.find((p) => p.id === id);
    if (!opt) return;

    if (id === "partner") {
      const ok = await run(async (s) => {
        await s.setShopPlan({ tier: "partner", planSource: null, planExpiresAt: null });
        return true;
      }, "Sign in to change your plan.");
      if (ok) {
        setNote("Switched to Partner. Pro screens are locked until you upgrade again.");
        reload();
      }
      return;
    }

    // No PayMongo secret in this build → demo path upgrades the shop immediately.
    const ok = await run(async (s) => {
      try {
        await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId: shop.id,
            planOptionId: id,
            amountCentavos: opt.priceCentavos,
            demo: true,
          }),
        });
      } catch {
        /* offline / static export */
      }
      await s.setShopPlan({
        tier: "paid",
        planSource: isLifetimeOption(id) ? "lifetime" : "demo",
        planExpiresAt: isLifetimeOption(id) ? null : monthlyExpiryFrom(),
      });
      return true;
    }, "Sign in to upgrade your plan.");
    if (ok) {
      setNote(
        isLifetimeOption(id)
          ? `Demo unlock: ${opt.title} is active on this shop (${opt.priceLabel} one-time).`
          : "Demo unlock: Pro monthly is active for ~30 days. Wire PayMongo to charge for real.",
      );
      reload();
    }
  }

  // Which plan the shop is on now (Lifetime 1–5 and 5+ share planSource "lifetime").
  const currentId: PlanOptionId =
    shop.tier !== "paid" ? "partner" : shop.planSource === "lifetime" ? "lifetime" : "paid_monthly";
  const currentIdx = PLAN_OPTIONS.findIndex((o) => o.id === currentId);

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[720px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" leading={<ShellBack />} title="Plans" subtitle={<SampleNote />} />

      {/* Plan ladder: where the shop sits, Partner first. */}
      <ol aria-label="Plans" className="mt-4 grid grid-cols-4 rounded-card bg-surface px-2 pb-3 pt-4 ring-1 ring-line">
        {PLAN_OPTIONS.map((opt, i) => {
          const on = i === currentIdx;
          return (
            <li key={opt.id} className="relative flex flex-col items-center gap-1.5" aria-current={on ? "step" : undefined}>
              {i > 0 ? <span aria-hidden className={`absolute right-1/2 top-[7px] h-px w-full ${i <= currentIdx ? "bg-ink" : "bg-line"}`} /> : null}
              <span aria-hidden className={`relative z-[1] size-[15px] rounded-full ${on ? "bg-ink ring-4 ring-ink/10" : i < currentIdx ? "bg-ink" : "bg-surface ring-1 ring-grey-300"}`} />
              <span className={`text-[12px] leading-tight ${on ? "font-extrabold text-ink" : "font-semibold text-muted"}`}>{opt.short}</span>
            </li>
          );
        })}
      </ol>

      {readOnlySample ? <p className="mt-3 px-1 text-[13px] font-semibold text-muted">Demo shop · plans can’t change here.</p> : null}

      <ul className="mt-3 flex flex-col gap-2.5">
        {PLAN_OPTIONS.map((opt) => {
          const active = opt.id === currentId;
          return (
            <li key={opt.id} className={`rounded-card bg-surface px-4 py-4 ${active ? "ring-2 ring-ink" : "ring-1 ring-line"}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col">
                  <span className="flex items-center gap-2">
                    <b className="text-[17px] tracking-[-0.01em]">{opt.title}</b>
                    {active ? <span className="rounded-pill bg-ink px-2 py-0.5 text-[11px] font-bold text-on-ink">Current</span> : null}
                  </span>
                  <span className="mt-1 text-[13px] font-semibold text-muted">{opt.features.join(" · ")}</span>
                </span>
                <span className="flex flex-none flex-col items-end leading-none">
                  {opt.priceLabel ? (
                    <>
                      {opt.wasLabel ? <s className="text-[12.5px] font-semibold text-muted">{opt.wasLabel}</s> : null}
                      <b className="mt-1 text-[20px] font-extrabold tracking-[-0.02em]">{opt.priceLabel}</b>
                      <small className="mt-1 text-[11.5px] font-semibold text-muted">{opt.id === "paid_monthly" ? "/ month" : "one-time"}</small>
                    </>
                  ) : (
                    <b className="text-[14px] font-extrabold">Entry</b>
                  )}
                </span>
              </div>
              {active ? null : (
                <Button
                  className="mt-3"
                  size="sm"
                  fullWidth
                  variant={opt.id === "partner" ? "secondary" : "primary"}
                  disabled={!canManage || busy}
                  onClick={() => void choose(opt.id)}
                >
                  {opt.id === "partner" ? "Switch to Partner" : `Choose ${opt.title}`}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {note ? <p className="mt-3 text-[14px] font-semibold">{note}</p> : null}
      <p className="mt-4 px-1 text-center text-[12.5px] font-medium text-muted">Online payment is coming soon. Choosing a plan applies a demo upgrade.</p>
    </div>
  );
}
