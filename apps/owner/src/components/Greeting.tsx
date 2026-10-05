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
        <span className="inline-flex items-center gap-1.5">
          <Button href="/online" variant="secondary" size="xs" pill>
            Online Orders
          </Button>
          <Link
            href="/profile"
            aria-label="Profile"
            className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <Avatar
              name={name}
              preset={photoUrl ? undefined : avatar}
              src={photoUrl}
              size={44}
              decorative={false}
            />
          </Link>
        </span>
      }
    />
  );
}
