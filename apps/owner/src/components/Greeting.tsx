"use client";
import type { AvatarPreset } from "@river-apps/icons";
import { Avatar } from "@river-apps/ui";
import { Button } from "@/components/common/Button";
import { ChartColumn } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useGreeting } from "@/lib/greeting";

/** Short, privacy-friendly account id: "jimb…@gmail.com" or "0917•••123". */
export function shortAccountId(email?: string | null, phone?: string | null): string | null {
  if (email) {
    const [local = "", domain = ""] = email.split("@");
    return `${local.length > 4 ? `${local.slice(0, 4)}…` : local}@${domain}`;
  }
  if (phone) {
    let d = phone.replace(/\D/g, "");
    if (d.startsWith("63") && d.length === 12) d = `0${d.slice(2)}`;
    return d.length > 7 ? `${d.slice(0, 4)}•••${d.slice(-3)}` : d;
  }
  return null;
}

/** Avatar, "My Account", and a shortened email or phone. Links to Profile. */
export function MyAccountLink({ avatar, name, photoUrl }: { avatar: AvatarPreset; name: string; photoUrl?: string }) {
  const { user } = useAuth();
  const accountId = user ? shortAccountId(user.email, user.phoneNumber) : null;
  return (
    <Link
      href="/profile"
      aria-label={user ? `My Account${accountId ? `, ${accountId}` : ""}` : "My Account, sign in"}
      className="flex min-h-11 min-w-0 items-center gap-2 rounded-[14px] py-1 pr-1.5 transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <Avatar name={name} preset={photoUrl ? undefined : avatar} src={photoUrl} size={36} />
      <span className="flex min-w-0 flex-col leading-[1.2]">
        <span className="text-[13px] font-medium text-ink">My Account</span>
        <span className="max-w-[130px] truncate text-[11px] font-medium text-muted">
          {user ? (accountId ?? "Signed in") : "Sign in"}
        </span>
      </span>
    </Link>
  );
}

/** Sales, with a chart icon. Sits in the home header's right corner. */
export function SalesLink() {
  return (
    <Button
      href="/sales"
      variant="secondary"
      size="xs"
      pill
      className="relative flex-none after:absolute after:inset-x-0 after:-inset-y-2 after:content-['']"
      leadingIcon={<ChartColumn size={14} strokeWidth={2.1} />}
    >
      Sales
    </Button>
  );
}

/**
 * Phone header row: My Account on the left, Sales on the right. Optional greeting title below.
 */
export function Greeting({
  title,
  avatar,
  name,
  photoUrl,
}: {
  /** Big greeting under the row (Partner home). Omit when the greeting lives in the hero card. */
  title?: string;
  avatar: AvatarPreset;
  name: string;
  /** Shop photo when set — same source as the Profile header. */
  photoUrl?: string;
}) {
  const greeting = useGreeting();
  return (
    <header className="px-4 pt-1">
      <div className="flex h-16 items-center justify-between gap-3">
        <MyAccountLink avatar={avatar} name={name} photoUrl={photoUrl} />
        <SalesLink />
      </div>
      {title ? (
        <div className="px-1 pb-1">
          <span className="block min-h-[18px] text-[12.5px] font-semibold text-muted">{greeting}</span>
          <b className="block truncate text-[17px] font-extrabold tracking-[-0.01em]">{title}</b>
        </div>
      ) : null}
    </header>
  );
}
