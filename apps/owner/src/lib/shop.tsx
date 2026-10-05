"use client";

/**
 * ShopProvider: resolves the signed-in user's shop and exposes a shop-bound LaundryDataSource.
 * In fixtures mode it serves the in-memory sample shop immediately.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  dataMode, type Customer, type LaundryDataSource, type Membership, type Order, type Shop, type WatchOrdersOptions,
} from "@/data";
import { createFirebaseDataSource, firestoreErrorMessage } from "@/data/firebase-source";
import { createFixtureDataSource } from "@/data/fixture-source";
import * as fx from "@/data/fixtures";
import { getJoinableDemoShop, resolveMembership } from "@/data/membership";
import { useAuth } from "./auth";

export type ShopState =
  | { status: "loading" }
  | { status: "ready"; shop: Shop; member: Membership; source: LaundryDataSource; isSample: boolean; reload: () => void }
  | { status: "onboarding"; demoShop: Pick<Shop, "id" | "name" | "area"> | null; reload: () => void }
  | { status: "error"; message: string; reload: () => void };

const ShopContext = createContext<ShopState | null>(null);

let fixtureSource: LaundryDataSource | null = null;

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<ShopState>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (dataMode() === "fixtures") {
        fixtureSource ??= createFixtureDataSource();
        setState({ status: "ready", shop: fx.shop, member: { uid: user?.uid ?? "demo", shopId: fx.shop.id, role: "owner", status: "active" }, source: fixtureSource, isSample: true, reload });
        return;
      }
      if (!user) return;
      setState({ status: "loading" });
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
        if (!cancelled) setState({ status: "ready", shop, member, source, isSample: shop.sample === true, reload });
      } catch (err) {
        if (!cancelled) setState({ status: "error", message: firestoreErrorMessage(err), reload });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [user, nonce, reload]);

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

/** Wrap a mutation with busy / error state. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(firestoreErrorMessage(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}
