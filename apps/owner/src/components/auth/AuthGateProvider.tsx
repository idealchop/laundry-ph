"use client";

/**
 * Guest browse + login-on-action (River Mobile useAuthGate / AuthGateSheet).
 * requireAuth(action): if authenticated run action; else open sheet and on success
 * run the pending callback via requestAnimationFrame. Dismiss clears pending.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { AuthGateSheet } from "./AuthGateSheet";

type AuthGateApi = {
  isAuthenticated: boolean;
  isGuest: boolean;
  openAuth: (after?: () => void, subtitle?: string) => void;
  requireAuth: (action: () => void, subtitle?: string) => void;
  /** Soft CTA — open sheet with no pending action (settings profile). */
  openAuthCta: (subtitle?: string) => void;
};

const Ctx = createContext<AuthGateApi | null>(null);

export function useAuthGate(): AuthGateApi {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuthGate() must be used inside <AuthGateProvider>");
  return v;
}

export function useAuthGateOptional() {
  return useContext(Ctx);
}

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user, loading, isGuest } = useAuth();
  const authed = Boolean(user) && !loading;
  const [open, setOpen] = useState(false);
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const pendingRef = useRef<(() => void) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    pendingRef.current = null;
    const cancel = cancelRef.current;
    cancelRef.current = null;
    cancel?.();
  }, []);

  const openAuth = useCallback(
    (after?: () => void, text?: string) => {
      if (authed) {
        after?.();
        return;
      }
      pendingRef.current = after ?? null;
      setSubtitle(text);
      setOpen(true);
    },
    [authed],
  );

  const requireAuth = useCallback(
    (action: () => void, text?: string) => {
      openAuth(action, text);
    },
    [openAuth],
  );

  const openAuthCta = useCallback(
    (text = "Sign in to sync your shop and save changes.") => {
      cancelRef.current = null;
      pendingRef.current = null;
      setSubtitle(text);
      setOpen(true);
    },
    [],
  );

  const onAuthenticated = useCallback(() => {
    setOpen(false);
    cancelRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    requestAnimationFrame(() => next?.());
  }, []);

  // Expose cancel registration for useAction promises
  useEffect(() => {
    (globalThis as unknown as { __laundryAuthCancel?: (fn: (() => void) | null) => void }).__laundryAuthCancel = (fn) => {
      cancelRef.current = fn;
    };
    return () => {
      delete (globalThis as unknown as { __laundryAuthCancel?: unknown }).__laundryAuthCancel;
    };
  }, []);

  const value = useMemo<AuthGateApi>(
    () => ({ isAuthenticated: authed, isGuest: isGuest && !authed, openAuth, requireAuth, openAuthCta }),
    [authed, isGuest, openAuth, requireAuth, openAuthCta],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <AuthGateSheet open={open} onClose={close} onAuthenticated={onAuthenticated} subtitle={subtitle} />
    </Ctx.Provider>
  );
}

/** Commit screens (billing / save address): optionally prompt guests on mount. */
export function useAuthGatePrompt(options: { promptOnMount?: boolean; subtitle?: string } = {}) {
  const { promptOnMount = false, subtitle } = options;
  const gate = useAuthGate();
  const opened = useRef(false);
  useEffect(() => {
    if (promptOnMount && gate.isGuest && !gate.isAuthenticated && !opened.current) {
      opened.current = true;
      gate.openAuth(undefined, subtitle);
    }
  }, [promptOnMount, gate, subtitle]);
  return gate;
}
