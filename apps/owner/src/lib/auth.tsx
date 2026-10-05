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
  signOut as fbSignOut,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getFirebaseAuth } from "@/lib/firebase/client";

const GUEST_KEY = "laundry-ph-guest-v1";

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
  enterAsGuest: () => void;
  clearGuest: () => void;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  isAuthenticated: false,
  isGuest: false,
  enterAsGuest: () => undefined,
  clearGuest: () => undefined,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // false on SSR; first client render reads localStorage via lazy init
  const [isGuest, setIsGuest] = useState(() => readGuestFlag());

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
      enterAsGuest,
      clearGuest,
    }),
    [user, loading, isGuest, enterAsGuest, clearGuest],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

/* ---------- Phone (SMS code) sign-in ---------- */

let pending: { phoneE164: string; confirmation: ConfirmationResult; sentAt: number } | null = null;
let verifier: RecaptchaVerifier | null = null;

/** Sends the SMS code using an invisible reCAPTCHA attached to the Send button. */
export async function sendPhoneCode(phoneE164: string, buttonId: string) {
  const auth = getFirebaseAuth();
  verifier?.clear();
  verifier = new RecaptchaVerifier(auth, buttonId, { size: "invisible" });
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
  pending = { phoneE164, confirmation, sentAt: Date.now() };
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
    if ((err as { code?: string })?.code === "auth/popup-blocked") await signInWithRedirect(auth, provider);
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
  if (code.includes("invalid-verification-code")) return "That code is not right. Please check and try again.";
  if (code.includes("code-expired")) return "That code expired. Please request a new one.";
  if (code.includes("invalid-phone-number")) return "Please enter a valid PH mobile number.";
  if (code.includes("too-many-requests")) return "Too many tries. Please wait a few minutes.";
  if (code.includes("popup-closed") || code.includes("cancelled-popup-request")) return "Google sign-in was closed before finishing.";
  if (code.includes("unauthorized-domain")) return "This site is not allowed to sign in yet. Please contact support.";
  if (code.includes("captcha")) return "We couldn’t verify you’re not a robot. Please try again.";
  if (code.includes("network-request-failed")) return "No connection. Check your internet and try again.";
  if (code.includes("operation-not-allowed")) return "That sign-in method is not enabled yet.";
  return "Something went wrong. Please try again.";
}
