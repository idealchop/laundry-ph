"use client";

/**
 * ShopProvider: signed-in shop from Firestore, or in-memory sample for guests
 * (River Mobile browse-first). Mutations go through useAction → AuthGate.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  dataMode, type Booking, type BookingScope, type Customer, type LaundryDataSource, type Membership, type Order, type Shop, type WatchOrdersOptions,
} from "@/data";
import { createFirebaseDataSource, firestoreErrorMessage } from "@/data/firebase-source";
import { createFixtureDataSource } from "@/data/fixture-source";
import * as fx from "@/data/fixtures";
import { getJoinableDemoShop, resolveMembership } from "@/data/membership";
import { useAuthGateOptional } from "@/components/auth/AuthGateProvider";
import { useAuth } from "./auth";

export type ShopState =
  | { status: "loading" }
  | { status: "ready"; shop: Shop; member: Membership; source: LaundryDataSource; isSample: boolean; isGuest: boolean; reload: () => void }
  | { status: "onboarding"; demoShop: Pick<Shop, "id" | "name" | "area"> | null; reload: () => void }
  | { status: "error"; message: string; reload: () => void };

const ShopContext = createContext<ShopState | null>(null);

let fixtureSource: LaundryDataSource | null = null;
/** Latest ready data source — resume mutations after AuthGate against this. */
let activeSource: LaundryDataSource | null = null;

export function getActiveSource(): LaundryDataSource | null {
  return activeSource;
}

function waitForReadySource(timeoutMs = 15_000): Promise<LaundryDataSource> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const s = activeSource;
      // Prefer a non-guest firebase/fixtures source after login (member uid !== guest).
      if (s) {
        resolve(s);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("Signed in, but your shop is still opening. Try the action again."));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}


function guestReady(reload: () => void): ShopState {
  fixtureSource ??= createFixtureDataSource();
  activeSource = fixtureSource;
  return {
    status: "ready",
    shop: { ...fx.shop },
    member: { uid: "guest", shopId: fx.shop.id, role: "owner", status: "active" },
    source: fixtureSource,
    isSample: true,
    isGuest: true,
    reload,
  };
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, isGuest, enterAsGuest } = useAuth();
  const [state, setState] = useState<ShopState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (authLoading) {
        setState({ status: "loading" });
        return;
      }

      // No Firebase user → browse sample shop as guest (auto-enter + persist).
      if (!user) {
        if (!isGuest) enterAsGuest();
        if (!cancelled) setState(guestReady(reload));
        return;
      }

      if (dataMode() === "fixtures") {
        fixtureSource ??= createFixtureDataSource();
        activeSource = fixtureSource;
        if (!cancelled) {
          setState({
            status: "ready",
            shop: await fixtureSource.getShop(),
            member: { uid: user.uid, shopId: fx.shop.id, role: "owner", status: "active" },
            source: fixtureSource,
            isSample: true,
            isGuest: false,
            reload,
          });
        }
        return;
      }

      setState({ status: "loading" });
      activeSource = null;
      try {
        const member = await resolveMembership(user.uid);
        if (cancelled) return;
        if (!member) {
          const demoShop = await getJoinableDemoShop();
          if (!cancelled) setState({ status: "onboarding", demoShop, reload });
          return;
        }
        const source = createFirebaseDataSource(member.shopId);
        const shop = await source.getShop();
        if (!cancelled) {
          activeSource = source;
          setState({ status: "ready", shop, member, source, isSample: shop.sample === true, isGuest: false, reload });
        }
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: firestoreErrorMessage(err), reload });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, isGuest, enterAsGuest, nonce, reload]);

  return <ShopContext.Provider value={state}>{children}</ShopContext.Provider>;
}

/** Raw state (null outside the provider, e.g. on the public ticket page). */
export const useShopState = () => useContext(ShopContext);

/** The ready shop. Only call under <ShopGate>. */
export function useShop() {
  const s = useContext(ShopContext);
  if (!s || s.status !== "ready") throw new Error("useShop() used outside a ready <ShopGate>");
  return s;
}

/* ---------- Data hooks ---------- */

export interface AsyncState<T> {
  data?: T;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Run a one-shot read against the shop's data source. */
export function useShopQuery<T>(fn: (source: LaundryDataSource) => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const { source } = useShop();
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([source.shopId, source.mode, nonce, ...deps]);
  const [state, setState] = useState<{ key: string; data?: T; error: string | null }>({ key: "", error: null });
  useEffect(() => {
    let cancelled = false;
    fn(source).then(
      (data) => !cancelled && setState({ key, data, error: null }),
      (err) => !cancelled && setState({ key, error: firestoreErrorMessage(err) }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const fresh = state.key === key;
  return { data: state.data, error: fresh ? state.error : null, loading: !fresh, reload: () => setNonce((n) => n + 1) };
}

/** Live orders for the current shop. */
export function useOrders(opts: WatchOrdersOptions = {}) {
  const { source } = useShop();
  const { sinceMs, openOnly } = opts;
  const key = `${source.mode}|${source.shopId}|${sinceMs ?? ""}|${openOnly ? 1 : 0}`;
  const [state, setState] = useState<{ key: string; orders: Order[]; error: string | null }>({ key: "", orders: [], error: null });
  useEffect(
    () =>
      source.watchOrders(
        { sinceMs, openOnly },
        (orders) => setState({ key, orders, error: null }),
        (e) => setState({ key, orders: [], error: e.message }),
      ),
    [source, sinceMs, openOnly, key],
  );
  const fresh = state.key === key;
  return { orders: fresh ? state.orders : [], error: fresh ? state.error : null, loading: !fresh };
}

/** Recent orders (since `sinceMs`) merged with every open order, newest first, de-duplicated. */
export function useBoardOrders(sinceMs: number) {
  const recent = useOrders({ sinceMs });
  const open = useOrders({ openOnly: true });
  const orders = useMemo(() => {
    const byId = new Map<string, Order>();
    for (const o of [...recent.orders, ...open.orders]) byId.set(o.id, o);
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
  }, [recent.orders, open.orders]);
  return { orders, error: recent.error ?? open.error, loading: recent.loading || open.loading };
}

export function useOrder(orderId: string | null) {
  const { source } = useShop();
  const key = `${source.mode}|${source.shopId}|${orderId ?? ""}`;
  const [state, setState] = useState<{ key: string; order: Order | null; error: string | null }>({ key: "", order: null, error: null });
  useEffect(() => {
    if (!orderId) return;
    return source.watchOrder(orderId, (order) => setState({ key, order, error: null }), (e) => setState({ key, order: null, error: e.message }));
  }, [source, orderId, key]);
  if (!orderId) return { order: null, error: null, loading: false };
  const fresh = state.key === key;
  return { order: fresh ? state.order : null, error: fresh ? state.error : null, loading: !fresh };
}

/** Live River Mobile bookings for the current shop ("open" or "history"). */
export function useBookings(scope: BookingScope) {
  const { source } = useShop();
  const key = `${source.mode}|${source.shopId}|${scope}`;
  const [state, setState] = useState<{ key: string; bookings: Booking[]; error: string | null }>({ key: "", bookings: [], error: null });
  useEffect(
    () => source.watchBookings(scope, (bookings) => setState({ key, bookings, error: null }), (e) => setState({ key, bookings: [], error: e.message })),
    [source, scope, key],
  );
  const fresh = state.key === key;
  return { bookings: fresh ? state.bookings : [], error: fresh ? state.error : null, loading: !fresh };
}

export function useCustomers() {
  const { source } = useShop();
  const key = `${source.mode}|${source.shopId}`;
  const [state, setState] = useState<{ key: string; customers: Customer[]; error: string | null }>({ key: "", customers: [], error: null });
  useEffect(
    () => source.watchCustomers((customers) => setState({ key, customers, error: null }), (e) => setState({ key, customers: [], error: e.message })),
    [source, key],
  );
  const fresh = state.key === key;
  return { customers: fresh ? state.customers : [], error: fresh ? state.error : null, loading: !fresh };
}

/**
 * Mutation helper. Guests hit AuthGate first; after sign-in the callback runs via rAF
 * against getActiveSource() when the fn uses the live source from the closure — callers
 * should prefer `run((source) => …)` so resume uses the post-login shop.
 */
export function useAction(defaultReason = "Sign in to save this change.") {
  const gate = useAuthGateOptional();
  const { user } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async <T,>(fn: (source: LaundryDataSource) => Promise<T>, reason = defaultReason): Promise<T | undefined> => {
      const execute = async () => {
        setBusy(true);
        setError(null);
        try {
          const src = await waitForReadySource();
          return await fn(src);
        } catch (err) {
          setError(firestoreErrorMessage(err));
          return undefined;
        } finally {
          setBusy(false);
        }
      };

      if (!user) {
        if (!gate) {
          setError("Sign in to continue.");
          return undefined;
        }
        return new Promise<T | undefined>((resolve) => {
          const g = globalThis as unknown as { __laundryAuthCancel?: (fn: (() => void) | null) => void };
          g.__laundryAuthCancel?.(() => resolve(undefined));
          gate.requireAuth(() => {
            g.__laundryAuthCancel?.(null);
            void execute().then(resolve);
          }, reason);
        });
      }
      return execute();
    },
    [user, gate, defaultReason],
  );

  return { busy, error, run, setError };
}
