"use client";
import type { AvatarPreset } from "@river-apps/icons";
import { Avatar, Button } from "@river-apps/ui";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

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

/**
 * Phone header row: Online Orders pill top-left; top-right a "My Account" block (avatar + label and a
 * shortened email/phone, or "Sign in" for guests) linking to Profile. Optional greeting title below.
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
  const { user } = useAuth();
  const accountId = user ? shortAccountId(user.email, user.phoneNumber) : null;
  return (
    <header className="px-4 pt-1">
      <div className="flex h-16 items-center justify-between gap-3">
        <Button href="/online" variant="secondary" size="xs" pill className="flex-none">
          Online Orders
        </Button>
        <Link
          href="/profile"
          aria-label={user ? `My Account${accountId ? `, ${accountId}` : ""}` : "My Account, sign in"}
          className="group -mr-1.5 flex min-h-11 min-w-0 items-center gap-2 rounded-[14px] py-1 pl-1 pr-1.5 transition-colors hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Avatar name={name} preset={photoUrl ? undefined : avatar} src={photoUrl} size={36} />
          <span className="flex min-w-0 flex-col leading-[1.2]">
            <span className="text-[13px] font-medium text-ink">My Account</span>
            <span className="max-w-[130px] truncate text-[11px] font-medium text-muted">
              {user ? (accountId ?? "Signed in") : "Sign in"}
            </span>
          </span>
        </Link>
      </div>
      {title ? (
        <div className="px-1 pb-1">
          <span className="text-[12.5px] font-semibold text-muted">Good morning</span>
          <b className="block truncate text-[17px] font-extrabold tracking-[-0.01em]">{title}</b>
        </div>
      ) : null}
    </header>
  );
}
