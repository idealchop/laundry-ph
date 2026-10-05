"use client";

import { Button, Input } from "@river-apps/ui";
import { useState, type FormEvent } from "react";
import { createShop, joinDemoShop } from "@/data/membership";
import type { Shop } from "@/data";
import { signOut, useAuth } from "@/lib/auth";
import { useAction } from "@/lib/shop";
import { AuthScreen } from "./AuthScreen";
import { LaundryBrand, LaundryScene } from "./brand";
import { ErrorNote } from "./ui";

/** First sign-in: create your shop, or (dev only) open the seeded demo shop. */
export function Onboarding({ demoShop, onDone }: { demoShop: Pick<Shop, "id" | "name" | "area"> | null; onDone: () => void }) {
  const { user } = useAuth();
  const { busy, error, run } = useAction();
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [ownerName, setOwnerName] = useState(user?.displayName?.split(" ")[0] ?? "");

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    const ok = await run(async (source) => {
      void source;
      await createShop(user!, { name, area, ownerName });
      return true;
    }, "Sign in to create your shop.");
    if (ok) onDone();
  }
  async function joinDemo() {
    if (!user || !demoShop) return;
    const ok = await run(async (source) => {
      void source;
      await joinDemoShop(user!, demoShop.id);
      return true;
    }, "Sign in to open the demo shop.");
    if (ok) onDone();
  }

  return (
    <AuthScreen>
      <div className="px-6 pt-3.5"><LaundryBrand /></div>
      <div className="mx-auto mt-2"><LaundryScene size={180} /></div>
      <div className="px-6">
        <h1 className="text-[27px] font-extrabold leading-[1.15] tracking-[-0.025em]">Set up your shop</h1>
        <p className="mt-1.5 text-[15px] font-medium text-muted">
          Signed in as {user?.phoneNumber ?? user?.email ?? "you"}. Your orders, customers and sales are saved to your shop.
        </p>
      </div>
      {demoShop ? (
        <div className="mx-6 mt-5 rounded-[22px] bg-grey-100 p-4">
          <b className="block text-[15px]">Try the demo shop</b>
          <small className="mb-3 mt-0.5 block text-[13px] font-semibold text-muted">
            {demoShop.name}{demoShop.area ? ` · ${demoShop.area}` : ""}. Sample data on the dev database, shared with other testers.
          </small>
          <Button fullWidth size="md" onClick={joinDemo} disabled={busy}>Open {demoShop.name}</Button>
        </div>
      ) : null}
      <form onSubmit={create} className="mt-5 flex flex-1 flex-col gap-3 px-6">
        <b className="text-[15px]">{demoShop ? "Or create your own shop" : "Create your shop"}</b>
        <Input size="md" label="Shop name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Liza’s Laundry" required minLength={2} maxLength={60} />
        <Input size="md" label="Area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Kapitolyo, Pasig" maxLength={80} />
        <Input size="md" label="Your first name" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Liza" maxLength={40} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <div className="mt-auto flex flex-col gap-2 pb-10 pt-4">
          <Button type="submit" fullWidth variant={demoShop ? "secondary" : "primary"} disabled={busy || name.trim().length < 2}>
            {busy ? "Saving…" : "Create shop"}
          </Button>
          <Button variant="ghost" size="md" fullWidth onClick={() => void signOut()}>Sign out</Button>
        </div>
      </form>
    </AuthScreen>
  );
}
