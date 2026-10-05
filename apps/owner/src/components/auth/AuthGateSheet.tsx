"use client";

/**
 * Bottom sheet sign-in — mirrors River Mobile AuthGateSheet.
 * Guest can dismiss; signing in stays on the current screen and resumes the pending action.
 */
import { ChatIcon } from "@river-apps/icons";
import { Button, OtpInput, PhoneInput, formatPhilippineMobile, cn } from "@river-apps/ui";
import { X } from "lucide-react";
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

export function AuthGateSheet(props: Props) {
  if (!props.open) return null;
  return <AuthGateSheetOpen key="open" {...props} />;
}

function AuthGateSheetOpen({ onClose, onAuthenticated, subtitle = "Sign in to sync your shop. You can dismiss and keep browsing." }: Props) {
  const { user } = useAuth();
  const btnId = `laundry-gate-${useId().replace(/:/g, "")}`;
  const [step, setStep] = useState<"methods" | "code">("methods");
  const [formatted, setFormatted] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!e164) return setError("Enter your 10-digit mobile number, e.g. 917 123 4567.");
    setError(null);
    setBusy(true);
    try {
      await sendPhoneCode(e164, btnId);
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

  const pending = pendingPhone();
  const national = pending ? formatPhilippineMobile(pending.phoneE164.replace(/^\+63/, "")) : "";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="laundry-auth-gate-title">
      <button type="button" className="absolute inset-0 bg-ink/45" aria-label="Dismiss" onClick={onClose} />
      <div className={cn("relative z-[1] flex w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-surface shadow-card sm:max-h-[90dvh] sm:rounded-[28px]")}>
        <div className="flex items-center justify-between bg-ink px-5 py-4 text-on-ink">
          <b className="text-[15px] tracking-[-0.01em]">Laundry.ph</b>
          <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-full bg-white/15" aria-label="Close">
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
        <div className="max-h-[min(70dvh,560px)] overflow-y-auto px-5 pb-6 pt-5">
          <h2 id="laundry-auth-gate-title" className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.025em]">
            Sign up or log in
          </h2>
          <p className="mt-2 text-[14.5px] font-medium leading-snug text-muted">{subtitle}</p>

          {step === "methods" ? (
            <form onSubmit={(e) => void sendCode(e)} className="mt-5 flex flex-col gap-2.5">
              <PhoneInput
                label="Mobile number"
                value={formatted}
                onChange={(f, v) => { setFormatted(f); setE164(v); }}
                hint="Demo: 917 123 4567 · code 123456"
                error={error ?? undefined}
              />
              <Button id={btnId} type="submit" fullWidth disabled={busy || !e164} leadingIcon={<ChatIcon size={20} />}>
                {busy ? "Sending…" : "Continue with phone"}
              </Button>
              <Button type="button" fullWidth variant="secondary" leadingIcon={<GoogleG />} disabled={busy} onClick={() => void google()}>
                Continue with Google
              </Button>
            </form>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              <p className="text-[14.5px] font-medium text-muted">Code sent to +63 {national}.</p>
              <OtpInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} autoFocus error={!!error} />
              {error ? <p role="alert" className="text-[13.5px] font-semibold">{error}</p> : null}
              <Button fullWidth disabled={busy || code.length < 6} onClick={() => void verify()}>
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button fullWidth variant="ghost" disabled={busy} onClick={() => { setStep("methods"); setCode(""); setError(null); }}>
                Use a different number
              </Button>
            </div>
          )}

          {step === "methods" && error ? <p role="alert" className="mt-3 text-center text-[13.5px] font-semibold">{error}</p> : null}
          <p className="mt-4 text-center text-[12px] font-medium text-muted">You can dismiss and keep browsing. Sign in to sync your shop and save changes.</p>
        </div>
      </div>
    </div>
  );
}
