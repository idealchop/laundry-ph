"use client";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { Icon3D } from "@river-apps/icons";
import { Avatar, Button, IconButton, IconTile, ListItem, StatusDot } from "@river-apps/ui";
import type { PickupRequest } from "@/data";
import { peso } from "@/lib/format";

/** A new River Mobile pickup with Accept / Decline. UI-only: the decision lives in local state. */
export function PickupRequestCard({ request }: { request: PickupRequest }) {
  const [decision, setDecision] = useState<"open" | "accepted" | "declined">("open");
  const r = request;
  return (
    <ListItem
      leading={<IconTile><Icon3D name={r.icon} size={36} /></IconTile>}
      title={`${r.kind === "pickup" ? "Pickup" : "Drop-off"} · ${r.serviceName}`}
      subtitle={<>{r.window}{r.estimateKg ? ` · about ${r.estimateKg} kg` : ""}</>}
      trailing={r.estimate ? <span className="text-[16px] font-extrabold">~{peso(r.estimate)}</span> : undefined}
      footer={<>
        <span className="flex items-center gap-[11px]">
          <Avatar name={r.customer.name} preset={r.customer.avatar} size={30} />
          <span className="flex flex-col leading-[1.2]">
            <b className="text-[13.5px]">{r.customer.name}</b>
            <small className="text-[12px] font-semibold text-muted">{[r.area, r.distanceKm ? `${r.distanceKm} km` : null].filter(Boolean).join(" · ")}</small>
          </span>
        </span>
        {decision === "open" ? (
          <span className="flex items-center gap-2">
            <IconButton size="md" label="Decline" onClick={() => setDecision("declined")} icon={<X size={18} strokeWidth={1.75} />} className="text-muted" />
            <Button size="sm" pill onClick={() => setDecision("accepted")} className="h-11 px-4 text-[14px]" leadingIcon={<Check size={17} strokeWidth={2.2} />}>Accept</Button>
          </span>
        ) : (
          <span className="flex items-center gap-2" role="status">
            <StatusDot tone={decision === "accepted" ? "active" : "idle"}>{decision === "accepted" ? "Accepted · customer notified" : "Declined"}</StatusDot>
            <Button size="sm" variant="ghost" className="h-11" onClick={() => setDecision("open")}>Undo</Button>
          </span>
        )}
      </>}
    />
  );
}
