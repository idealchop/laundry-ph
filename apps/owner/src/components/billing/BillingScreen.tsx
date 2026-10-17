"use client";

/**
 * Plan selection + payment UX.
 * PayMongo keys are not wired yet — checkout shows prices and a clear demo/test upgrade
 * that writes shops/{id}.tier in Firestore. Stub webhook lives at /api/billing/webhook.
 */
import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Badge, Card, Topbar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { PLAN_OPTIONS, monthlyExpiryFrom, planLabel, type PlanOptionId, isLifetimeOption } from "@/lib/plans";
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

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[960px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        leading={<ShellBack />}
        title="Plan & billing"
        subtitle={<>Partner, Pro or Lifetime <SampleNote className="ml-1 align-middle" /></>}
      />

      <Card className="mt-4 px-4 py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <b className="text-[16px]">Current plan</b>
            <p className="mt-0.5 text-[14px] font-semibold">{planLabel(shop.tier, shop.planSource)}</p>
            <p className="text-[13px] font-medium text-muted">
              {shop.tier === "paid"
                ? shop.planSource === "lifetime"
                  ? "Lifetime unlock — no renewal date"
                  : shop.planExpiresAt
                    ? `Demo/monthly access until ${new Date(shop.planExpiresAt).toLocaleDateString("en-PH", { timeZone: "Asia/Manila" })}`
                    : "Pro features unlocked"
                : "Partner — River Mobile bookings and scan"}
            </p>
          </div>
          <Badge variant={shop.tier === "paid" ? "solid" : "soft"}>{shop.tier === "paid" ? "Pro" : "Partner"}</Badge>
        </div>
      </Card>

      {readOnlySample ? (
        <p className="mt-3 rounded-tile bg-grey-100 px-4 py-3 text-[13.5px] font-semibold text-muted">
          The shared demo shop stays on Pro sample data. Create your own shop to try Partner ↔ Pro upgrades.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {PLAN_OPTIONS.map((opt) => {
          const active =
            (opt.id === "partner" && shop.tier === "partner") ||
            (opt.id === "lifetime" && shop.tier === "paid" && shop.planSource === "lifetime") ||
            (opt.id === "paid_monthly" && shop.tier === "paid" && shop.planSource !== "lifetime");
          return (
            <Card key={opt.id} className={`flex flex-col px-4 py-4 ${active ? "ring-2 ring-ink" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <b className="text-[17px]">{opt.title}</b>
                {opt.id === "paid_monthly" ? <Sparkles size={18} className="text-ink" /> : null}
              </div>
              {opt.priceLabel ? (
                <p className="mt-2 flex items-baseline gap-2 leading-none">
                  {opt.wasLabel ? <s className="text-[15px] font-semibold text-muted">{opt.wasLabel}</s> : null}
                  <span className="text-[28px] font-extrabold tracking-[-0.03em]">{opt.priceLabel}</span>
                </p>
              ) : null}
              <p className="mt-1 text-[13px] font-semibold text-muted">{opt.period}</p>
              <p className="mt-2 text-[13.5px] font-medium text-ink-2">{opt.blurb}</p>
              <ul className="mt-3 flex flex-1 flex-col gap-1.5">
                {opt.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] font-medium text-ink-2">
                    <Check size={14} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-4"
                size="md"
                fullWidth
                variant={active ? "secondary" : opt.id === "partner" ? "ghost" : "primary"}
                disabled={!canManage || busy || active}
                onClick={() => void choose(opt.id)}
              >
                {active ? "Current plan" : opt.priceCentavos === 0 ? "Switch to Partner" : `Choose · ${opt.priceLabel}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 px-4 py-3.5">
        <b className="text-[15px]">Payments</b>
        <p className="mt-1 text-[13.5px] font-medium text-muted">
          PayMongo checkout isn’t live yet. Choosing Pro or Lifetime applies a demo upgrade so you can try it.
        </p>
      </Card>

      {error ? <ErrorNote className="mt-3">{error}</ErrorNote> : null}
      {note ? <p className="mt-3 text-[14px] font-semibold">{note}</p> : null}

      <div className="mt-4">
        <Button href="/settings" variant="secondary" size="md">
          Back to settings
        </Button>
      </div>
    </div>
  );
}
