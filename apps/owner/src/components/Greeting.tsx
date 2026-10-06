import type { AvatarPreset } from "@river-apps/icons";
import { Avatar, Button, Topbar } from "@river-apps/ui";
import Link from "next/link";
import { SampleNote } from "./SampleNote";

/** Phone header: "Good morning", bold title, Online Orders + profile (no left avatar). */
export function Greeting({
  title,
  avatar,
  name,
  photoUrl,
}: {
  title: string;
  avatar: AvatarPreset;
  name: string;
  /** Shop photo when set — same source as the Profile header. */
  photoUrl?: string;
}) {
  return (
    <Topbar
      variant="greeting"
      className="pt-1"
      eyebrow={<span className="inline-flex items-center gap-1.5">Good morning <SampleNote /></span>}
      title={title}
      actions={
        <span className="inline-flex items-start gap-1.5">
          {/* mt-[5px] centres the 30px pill on the 40px avatar (the label hangs below). */}
          <Button href="/online" variant="secondary" size="xs" pill className="mt-[5px]">
            Online Orders
          </Button>
          <Link
            href="/profile"
            aria-label="My Account"
            className="group flex min-w-11 flex-col items-center gap-0.5 rounded-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Avatar
              name={name}
              preset={photoUrl ? undefined : avatar}
              src={photoUrl}
              size={40}
            />
            <span className="whitespace-nowrap text-[11px] font-semibold leading-[13px] text-muted group-hover:text-ink">My Account</span>
          </Link>
        </span>
      }
    />
  );
}
