"use client";

import { LogOut } from "lucide-react";
import { Avatar, Badge, Button, Card, ListItem, Topbar } from "@river-apps/ui";
import { firestoreDatabaseId } from "@/lib/firebase/config";
import { signOut, useAuth } from "@/lib/auth";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";

/** Shop profile, your role and sign out. Staff management, plan and billing come later. */
export function SettingsScreen() {
  const { shop, member, source } = useShop();
  const { user } = useAuth();
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Settings" subtitle={<>Shop profile and account <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="px-4 py-3.5">
          <b className="text-[16px]">Shop</b>
          <ListItem variant="row" className="mt-2" leading={<Avatar name={shop.ownerName || shop.name} preset={shop.ownerAvatar} size={44} />}
            title={shop.name} subtitle={`${shop.area || "No area set"} · ${shop.tier === "paid" ? "Paid" : "Partner"}`}
            trailing={shop.sample ? <Badge variant="soft" size="sm">Demo shop</Badge> : undefined} />
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
            <dt className="font-semibold text-muted">Shop ID</dt><dd className="font-mono">{shop.id}</dd>
            <dt className="font-semibold text-muted">Data</dt><dd className="font-mono">{source.mode === "firebase" ? `Firestore · ${firestoreDatabaseId}` : "In-memory sample (nothing saved)"}</dd>
          </dl>
        </Card>
        <Card className="px-4 py-3.5">
          <b className="text-[16px]">You</b>
          <p className="mt-2 text-[14px] font-semibold">{user?.phoneNumber ?? user?.email ?? user?.displayName ?? "Signed in"}</p>
          <p className="text-[13px] font-medium text-muted">Role: {member.role === "owner" ? "Owner" : "Staff"}</p>
          <Button className="mt-3" variant="secondary" size="md" onClick={() => void signOut()} leadingIcon={<LogOut size={18} />}>Sign out</Button>
        </Card>
        <Card className="px-4 py-3.5 lg:col-span-2">
          <b className="text-[16px]">Coming later</b>
          <p className="mt-1 text-[13.5px] font-medium text-muted">Price list editor, staff invites and roles, plan and billing, River Mobile listing.</p>
        </Card>
      </div>
    </div>
  );
}
