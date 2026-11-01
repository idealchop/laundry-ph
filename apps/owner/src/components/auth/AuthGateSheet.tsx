"use client";

import Link from "next/link";
import { RiverMark } from "@/components/brand";
/**
 * Bottom sheet sign-in — mirrors River Mobile AuthGateSheet.
 * Two-step: method list → chosen method (phone form / OTP). Guest can dismiss.
 */
import { OtpInput, PhoneInput, formatPhilippineMobile, cn } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { ArrowLeft, Smartphone, X } from "lucide-react";
import { useEffect, useId, useState, type FormEvent } from "react";
import { GoogleG } from "@/components/brand";
import {
  authErrorMessage, confirmPhoneCode, pendingPhone, sendPhoneCode, signInWithGoogle, useAuth,
} from "@/lib/auth";

type Props = {
  open: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
  subtitle?: string;
};

type Step = "methods" | "phone" | "code";

export function AuthGateSheet(props: Props) {
  if (!props.open) return null;
  return <AuthGateSheetOpen key="open" {...props} />;
}

function AuthGateSheetOpen({
  onClose,
  onAuthenticated,
  subtitle = "Sign in to sync your shop and save changes.",
}: Props) {
  const { user } = useAuth();
  const btnId = `laundry-gate-${useId().replace(/:/g, "")}`;
  const [step, setStep] = useState<Step>("methods");
  const [formatted, setFormatted] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 60s resend cooldown after a code is sent; ticks only while it runs.
  const [sentAt, setSentAt] = useState<number | null>(() => pendingPhone()?.sentAt ?? null);
  const [now, setNow] = useState(() => Date.now());
  const left = sentAt ? Math.max(0, Math.ceil((sentAt + RESEND_MS - now) / 1000)) : 0;
  useEffect(() => {
    if (!left) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [left]);

  useEffect(() => {
    if (user) onAuthenticated();
  }, [user, onAuthenticated]);

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(authErrorMessage(e));
      setBusy(false);
    }
  }

  async function sendCode(e?: FormEvent) {
    e?.preventDefault();
    const to = e164 ?? pendingPhone()?.phoneE164 ?? null;
    if (!to) return setError("Enter your 10-digit mobile number, e.g. 917 123 4567.");
    if (left > 0 && to === pendingPhone()?.phoneE164) { setStep("code"); return; }
    setError(null);
    setBusy(true);
    try {
      await sendPhoneCode(to, btnId);
      const at = pendingPhone()?.sentAt ?? Date.now();
      setSentAt(at); setNow(Date.now());
      setCode("");
      setStep("code");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value = code) {
    if (value.length !== 6) return;
    setCode(value);
    setError(null);
    setBusy(true);
    try {
      await confirmPhoneCode(value);
    } catch (err) {
      setError(authErrorMessage(err));
      setBusy(false);
    }
  }

  function goMethods() {
    setStep("methods");
    setCode("");
    setError(null);
  }

  function goPhone() {
    setStep("phone");
    setCode("");
    setError(null);
  }

  const pending = pendingPhone();
  const national = pending ? formatPhilippineMobile(pending.phoneE164.replace(/^\+63/, "")) : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="laundry-auth-gate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className={cn("relative z-[1] flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-card sm:max-h-[90dvh] sm:rounded-[28px]")}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-[1] inline-flex size-9 items-center justify-center rounded-full bg-grey-100 text-ink hover:bg-grey-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          aria-label="Close"
        >
          <X size={16} strokeWidth={2.2} />
        </button>
        <div className="max-h-[min(70dvh,560px)] overflow-y-auto px-5 pb-6 pt-5">
          <div className="mb-4"><RiverMark size={30} /></div>
          <h2 id="laundry-auth-gate-title" className="pr-10 text-[24px] font-extrabold leading-[1.15] tracking-[-0.025em]">
            {step === "phone" ? "Your mobile number" : step === "code" ? "Enter the code" : "Sign up or log in"}
          </h2>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-muted">
            {step === "phone"
              ? "We’ll text you a 6-digit code to sign in."
              : step === "code"
                ? `Code sent to +63 ${national}.`
                : subtitle}
          </p>

          {step === "methods" ? (
            <div className="mt-5 flex flex-col gap-2.5">
              <Button
                type="button"
                fullWidth
                disabled={busy}
                leadingIcon={<Smartphone size={18} strokeWidth={2} className="text-white" aria-hidden />}
                onClick={() => goPhone()}
              >
                Continue with phone
              </Button>
              <Button type="button" fullWidth variant="secondary" leadingIcon={<GoogleG />} disabled={busy} onClick={() => void google()}>
                Continue with Google
              </Button>
              {error ? <p role="alert" className="text-center text-[13.5px] font-semibold">{error}</p> : null}
            </div>
          ) : null}

          {step === "phone" ? (
            <form onSubmit={(e) => void sendCode(e)} className="mt-5 flex flex-col gap-2.5">
              <ResendRow label="Mobile number" htmlFor={`${btnId}-phone`} left={sentAt ? left : null} busy={busy} onResend={() => void sendCode()} />
              <PhoneInput
                id={`${btnId}-phone`}
                hideLabel
                label="Mobile number"
                value={formatted}
                onChange={(f, v) => { setFormatted(f); setE164(v); setError(null); }}
                error={error ?? undefined}
              />
              <div id={btnId} aria-hidden />
              <Button type="submit" fullWidth disabled={busy || !e164} leadingIcon={<Smartphone size={18} strokeWidth={2} className="text-white" aria-hidden />}>
                {busy ? "Sending…" : "Text me a code"}
              </Button>
              <Button
                type="button"
                fullWidth
                variant="ghost"
                disabled={busy}
                leadingIcon={<ArrowLeft size={18} strokeWidth={2.2} />}
                onClick={goMethods}
              >
                Back
              </Button>
            </form>
          ) : null}

          {step === "code" ? (
            <div className="mt-5 flex flex-col gap-3">
              <ResendRow label="6-digit code" left={left} busy={busy} onResend={() => void sendCode()} />
              <div id={btnId} aria-hidden />
              <OtpInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} error={!!error} />
              {error ? <p role="alert" className="text-[13.5px] font-semibold">{error}</p> : null}
              <Button fullWidth disabled={busy || code.length < 6} onClick={() => void verify()}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button fullWidth variant="ghost" disabled={busy} onClick={goPhone}>
                Use a different number
              </Button>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[12px] font-medium text-muted">
            By continuing you agree to our{" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms</Link> and{" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

const RESEND_MS = 60_000;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Field label with the resend timer on the right: "Resend in 0:59", then a "Resend" link at 0. `left` null = nothing sent yet. */
function ResendRow({ label, htmlFor, left, busy, onResend }: { label: string; htmlFor?: string; left: number | null; busy: boolean; onResend: () => void }) {
  return (
    <div className="-mb-1.5 flex min-h-6 items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-[14px] font-bold text-ink">{label}</label>
      {left === null ? null : left > 0 ? (
        <span aria-live="polite" className="text-[13px] font-semibold tabular-nums text-muted">Resend in {mmss(left)}</span>
      ) : (
        <button type="button" disabled={busy} onClick={onResend} className="-my-2 min-h-11 px-1 text-[13px] font-bold text-ink underline underline-offset-2 disabled:opacity-50">Resend</button>
      )}
    </div>
  );
}
