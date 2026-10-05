import { Bell } from "lucide-react";
import type { AvatarPreset } from "@river-apps/icons";
import { Avatar, Button, IconButton, Topbar } from "@river-apps/ui";
import { SampleNote } from "./SampleNote";

/** Phone header: avatar, "Good morning", a bold title, Online + notifications. */
export function Greeting({ title, avatar, name, notifications }: { title: string; avatar: AvatarPreset; name: string; notifications: number }) {
  return (
    <Topbar
      variant="greeting"
      className="pt-1"
      leading={<Avatar name={name} preset={avatar} size={44} />}
      eyebrow={<span className="inline-flex items-center gap-1.5">Good morning <SampleNote /></span>}
      title={title}
      actions={
        <span className="inline-flex items-center gap-1.5">
          <Button href="/online" variant="secondary" size="xs" pill>
            Online Orders
          </Button>
          <IconButton variant="surface" label="Notifications" count={notifications} icon={<Bell size={22} strokeWidth={1.75} />} />
        </span>
      }
    />
  );
}
