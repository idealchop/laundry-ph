import { Bell } from "lucide-react";
import type { AvatarPreset } from "@river-apps/icons";
import { Avatar, IconButton, Topbar } from "@river-apps/ui";
import { SampleNote } from "./SampleNote";

/** Phone header: avatar, "Good morning", a bold title, notifications. */
export function Greeting({ title, avatar, name, notifications }: { title: string; avatar: AvatarPreset; name: string; notifications: number }) {
  return (
    <Topbar
      variant="greeting"
      className="pt-1"
      leading={<Avatar name={name} preset={avatar} size={44} />}
      eyebrow={<span className="inline-flex items-center gap-1.5">Good morning <SampleNote /></span>}
      title={title}
      actions={<IconButton variant="surface" label="Notifications" count={notifications} icon={<Bell size={22} strokeWidth={1.75} />} />}
    />
  );
}
