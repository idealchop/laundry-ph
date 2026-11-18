"use client";

/**
 * Firebase Auth + guest browse session (River Mobile pattern).
 * Guests persist in localStorage so relaunch returns to the dashboard.
 */
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

const GUEST_KEY = "laundry-ph-guest-v1";
/** Set just before a Google redirect so the return trip shows "Signing you in…" instead of guest data. */
const REDIRECT_KEY = "laundry-ph-auth-redirect";

function readRedirectFlag(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(REDIRECT_KEY) === "1"; } catch { return false; }
}

function readGuestFlag(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(GUEST_KEY) === "1";
  } catch {
    return false;
  }
}

function writeGuestFlag(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(GUEST_KEY, "1");
    else window.localStorage.removeItem(GUEST_KEY);
  } catch {
    /* ignore */
  }
}

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Firebase session present. */
  isAuthenticated: boolean;
  /** Browsing without an account (persisted). */
  isGuest: boolean;
  /** Back from a Google redirect and still finishing sign-in. */
  redirecting: boolean;
  enterAsGuest: () => void;
  clearGuest: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isGuest: false,
  redirecting: false,
  enterAsGuest: () => undefined,
  clearGuest: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // false on SSR; first client render reads localStorage via lazy init
  const [isGuest, setIsGuest] = useState(() => readGuestFlag());
  const [redirecting, setRedirecting] = useState(() => readRedirectFlag());

  useEffect(() => {
    if (!redirecting) return;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { window.sessionStorage.removeItem(REDIRECT_KEY); } catch { /* ignore */ }
      document.documentElement.removeAttribute("data-auth-redirect");
      setRedirecting(false);
    };
    getRedirectResult(getFirebaseAuth()).catch(() => null).finally(finish);
    const t = window.setTimeout(finish, 15_000); // never trap the user behind the overlay
    return () => window.clearTimeout(t);
  }, [redirecting]);

  useEffect(() => {
    return onAuthStateChanged(getFirebaseAuth(), (next) => {
      setUser(next);
      setLoading(false);
      if (next) {
        writeGuestFlag(false);
        setIsGuest(false);
      }
    });
  }, []);

  const enterAsGuest = useCallback(() => {
    writeGuestFlag(true);
    setIsGuest(true);
  }, []);

  const clearGuest = useCallback(() => {
    writeGuestFlag(false);
    setIsGuest(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      isGuest: Boolean(isGuest) && !user,
      redirecting,
      enterAsGuest,
      clearGuest,
    }),
    [user, loading, isGuest, redirecting, enterAsGuest, clearGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/* ---------- Phone (SMS code) sign-in ---------- */

let pending: { phoneE164: string; confirmation: ConfirmationResult; sentAt: number } | null = null;
let verifier: RecaptchaVerifier | null = null;
let widgetId: number | null = null;
const RECAPTCHA_HOST_ID = "laundry-recaptcha-host";

/** One container on <body>, outside any sheet, so it never unmounts. Hidden with visibility (display:none breaks reCAPTCHA). */
function recaptchaHost(): HTMLElement {
  let el = document.getElementById(RECAPTCHA_HOST_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = RECAPTCHA_HOST_ID;
    el.setAttribute("aria-hidden", "true");
    el.style.cssText = "position:fixed;left:0;bottom:0;width:1px;height:1px;overflow:hidden;visibility:hidden;pointer-events:none;";
    document.body.appendChild(el);
  }
  return el;
}

function resetVerifier() {
  try { verifier?.clear(); } catch { /* already gone */ }
  verifier = null;
  widgetId = null;
  const host = document.getElementById(RECAPTCHA_HOST_ID);
  if (host) host.innerHTML = ""; // clear() leaves the widget iframe; start clean
}

/** Create the invisible verifier once and render it ahead of time (call when the phone step opens). */
export function prepareRecaptcha(): RecaptchaVerifier | null {
  if (typeof document === "undefined") return null;
  if (verifier) return verifier;
  const host = recaptchaHost();
  const slot = document.createElement("div");
  host.appendChild(slot);
  verifier = new RecaptchaVerifier(getFirebaseAuth(), slot, { size: "invisible", "expired-callback": resetVerifier });
  void verifier.render().then((id) => { widgetId = id; }, () => resetVerifier());
  return verifier;
}

/**
 * Sends a 6-digit code by SMS (Firebase phone auth). reCAPTCHA runs invisibly from a body-level container,
 * never a puzzle in normal use. The verifier is reused; on any error it's cleared and rebuilt for the retry.
 * signInWithPhoneNumber runs straight from the tap (no awaits before it when the verifier is pre-rendered).
 */
export async function sendPhoneCode(phoneE164: string) {
  const auth = getFirebaseAuth();
  const v = prepareRecaptcha();
  if (!v) throw new Error("Couldn’t start phone sign-in. Reload and try again.");
  // A reCAPTCHA picture check that is closed (tap outside) never settles the Firebase promise, which left
  // the button on "Sending…" forever. Race it with a timeout and a cancel (Back) so the person can retry.
  let stop: ((err: unknown) => void) | null = null;
  const stopped = new Promise<never>((_, reject) => { stop = reject; });
  cancelSend = () => stop?.(Object.assign(new Error("Cancelled"), { code: "auth/cancelled" }));
  const timer = window.setTimeout(() => stop?.(Object.assign(new Error("Timed out"), { code: "auth/timeout" })), SEND_TIMEOUT_MS);
  // Picture check shown then closed without solving: stop right away instead of waiting for the timeout.
  let sawChallenge = false;
  let closedTicks = 0;
  const watch = window.setInterval(() => {
    if (challengeOpen()) { sawChallenge = true; closedTicks = 0; return; }
    // Solved checks also close; only stop when it closed with no answer for ~2s.
    if (sawChallenge && !challengeSolved() && ++closedTicks >= 3) {
      stop?.(Object.assign(new Error("Check closed"), { code: "auth/captcha-closed" }));
    }
  }, 700);
  try {
    const confirmation = await Promise.race([signInWithPhoneNumber(auth, phoneE164, v), stopped]);
    pending = { phoneE164, confirmation, sentAt: Date.now() };
  } catch (err) {
    console.warn("[phone-auth] send failed:", (err as { code?: string })?.code ?? err);
    resetVerifier();
    prepareRecaptcha(); // fresh widget ready for the next tap
    throw err;
  } finally {
    window.clearTimeout(timer);
    window.clearInterval(watch);
    cancelSend = null;
  }
}

const SEND_TIMEOUT_MS = 90_000;
/** The invisible widget already holds an answer (the check was solved). */
function challengeSolved(): boolean {
  const g = (window as unknown as { grecaptcha?: { getResponse?: (id?: number) => string } }).grecaptcha;
  try { return Boolean(g?.getResponse?.(widgetId ?? undefined)); } catch { return false; }
}
/** reCAPTCHA's picture check (bframe) is on screen. */
function challengeOpen(): boolean {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>('iframe[src*="recaptcha/api2/bframe"]')).some((f) => {
    const r = f.getBoundingClientRect();
    return r.height > 50 && r.bottom > 0 && getComputedStyle(f).visibility !== "hidden";
  });
}
let cancelSend: (() => void) | null = null;
/** Stop a send that is waiting on reCAPTCHA (Back / close). */
export function cancelPhoneSend() {
  cancelSend?.();
}

export const pendingPhone = () => pending;

export async function confirmPhoneCode(code: string) {
  if (!pending) throw new Error("Your code expired. Please request a new one.");
  await pending.confirmation.confirm(code);
  pending = null;
}

/* ---------- Google sign-in ---------- */

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    if ((err as { code?: string })?.code === "auth/popup-blocked") {
      try { window.sessionStorage.setItem(REDIRECT_KEY, "1"); } catch { /* ignore */ }
      await signInWithRedirect(auth, provider);
    }
    else throw err;
  }
}

export async function signOut() {
  writeGuestFlag(false);
  await fbSignOut(getFirebaseAuth());
}

/** Friendly messages for common Firebase Auth errors. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code === "auth/cancelled") return "";
  if (code === "auth/timeout") return "That took too long. Tap Text me a code again.";
  if (code === "auth/captcha-closed") return "The check was closed. Tap Text me a code again.";
  if (code.includes("invalid-verification-code")) return "That code is not right. Please check and try again.";
  if (code.includes("code-expired")) return "That code expired. Please request a new one.";
  if (code.includes("invalid-phone-number") || code.includes("missing-phone-number")) return "Please enter a valid PH mobile number.";
  if (code.includes("too-many-requests") || code.includes("quota-exceeded")) return "Too many tries. Please wait a few minutes.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup-request")) return "Google sign-in was closed before finishing.";
  if (code.includes("unauthorized-domain")) return "This site is not allowed to sign in yet. Please contact support.";
  if (code.includes("captcha") || code.includes("app-credential")) return "We couldn’t verify you’re not a robot. Please try again.";
  if (code.includes("network-request-failed")) return "No connection. Check your internet and try again.";
  if (code.includes("operation-not-allowed")) return "Text codes aren’t available for this number yet.";
  if (code.includes("billing-not-enabled")) return "Text codes are paused right now. Please use Google for now.";
  // Unknown: keep the code visible so support can tell what failed.
  return code ? `Couldn’t send. Please try again. (${code.replace(/^auth\//, "")})` : "Something went wrong. Please try again.";
}
