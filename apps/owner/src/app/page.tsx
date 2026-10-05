"use client";

import { Button, FloatingCard, ProgressRing } from "@river-apps/ui";
import { CoinIcon } from "@river-apps/icons";
import { Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GoogleG, LaundryBrand, LaundryScene } from "@/components/brand";
import { AuthScreen } from "@/components/AuthScreen";
import { authErrorMessage, signInWithGoogle, useAuth } from "@/lib/auth";

/** Welcome / sign in — Mycarwash-style entry + Continue as guest (River Mobile). */
export default function WelcomePage() {
  const { user, loading, isGuest, enterAsGuest } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && (user || isGuest)) router.replace("/home");
  }, [loading, user, isGuest, router]);

  async function google() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function browseAsGuest() {
    enterAsGuest();
    router.replace("/home");
  }

  return (
    <AuthScreen>
      <div className="px-6 pt-3.5"><LaundryBrand /></div>
      <div className="relative mx-4 mt-[18px] h-[322px] overflow-hidden rounded-[32px] bg-[radial-gradient(60%_55%_at_50%_60%,#fff_0%,rgba(255,255,255,0)_70%),linear-gradient(180deg,#ECECEF,#F6F6F8)]">
        <div className="absolute inset-x-[-8px] bottom-[18px] flex justify-center">
          <LaundryScene size={280} />
        </div>
        <FloatingCard className="absolute left-[18px] top-[22px]" icon={<ProgressRing value={58} size={36} thickness={4.5} label="18m" labelSize={9} />} title="Washer 1" subtitle="Washing" />
        <FloatingCard className="absolute right-4 top-[70px]" icon={<CoinIcon size={30} />} title="+₱248" subtitle="New walk-in" />
      </div>
      <div className="px-7 pt-[26px]">
        <h1 className="text-[31px] font-extrabold leading-[1.12] tracking-[-0.03em]">Run your laundry<br />from your phone</h1>
        <p className="mt-2.5 text-[16px] font-medium text-muted">Orders, pickups and today’s sales in one simple app.</p>
      </div>
      <div className="mt-auto flex flex-col gap-2.5 px-6 pb-10 pt-6">
        <Button href="/sign-in/phone" fullWidth leadingIcon={<Smartphone size={20} strokeWidth={1.75} />}>Continue with phone number</Button>
        <Button fullWidth variant="secondary" leadingIcon={<GoogleG />} onClick={google} disabled={busy}>Continue with Google</Button>
        <Button fullWidth variant="ghost" onClick={browseAsGuest}>Continue as guest</Button>
        {error ? <p role="alert" className="text-center text-[13.5px] font-semibold">{error}</p> : null}
        <p className="mt-1.5 text-center text-[12.5px] font-medium text-muted">
          Guest browse is free — we’ll open sign-in when you enter the app. Dismiss anytime; sign in to save changes.
        </p>
        <p className="text-center text-[12.5px] font-medium text-muted">Demo: +63 917 123 4567 · code 123456</p>
      </div>
    </AuthScreen>
  );
}
