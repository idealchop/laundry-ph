"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { ChatIcon } from "@river-apps/icons";
import { Button, Card, IconButton, IconTile, PhoneInput, StatusDot, cn } from "@river-apps/ui";

/** Optional SMS opt-in ("With option to gather customer information" in the feature map). UI-only until SMS automations ship (Phase 2): the number is not stored. */
export function SmsOptIn() {
  const [state, setState] = useState<"idle" | "editing" | "saved">("idle");
  return (
    <Card className="mx-4 mt-2.5 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <IconTile size={44}><ChatIcon size={30} /></IconTile>
        <span className="flex min-w-0 flex-1 flex-col leading-[1.25]">
          <b className="text-[14px]">Text me when ready</b>
          {state === "saved" ? <StatusDot role="status">SMS alerts are coming soon. Check this page for updates.</StatusDot> : <small className="text-[12px] font-semibold text-muted">Optional · SMS updates</small>}
        </span>
        {state === "idle" ? <Button variant="secondary" size="md" className="h-11 px-3.5 text-[13.5px]" onClick={() => setState("editing")}>Add number</Button> : null}
      </div>
      {state === "editing" ? (
        <form className="mt-3 flex flex-col gap-2.5" onSubmit={(e) => { e.preventDefault(); setState("saved"); }}>
          <PhoneInput hideLabel autoFocus />
          <Button type="submit" variant="secondary" size="md" fullWidth>Save number</Button>
        </form>
      ) : null}
    </Card>
  );
}

/** 1–5 star feedback. */
export function FeedbackStars({ prompt = "Rate your last visit" }: { prompt?: string }) {
  const [rating, setRating] = useState(0);
  return (
    <Card className="mx-4 mt-2.5 flex items-center justify-between gap-2 px-4 py-2.5">
      <span className="flex flex-col leading-[1.25]">
        <b className="text-[14px]">{rating ? "Salamat! Thank you" : "How did we do?"}</b>
        <small className="text-[12px] font-semibold text-muted">{rating ? `You rated ${rating} of 5` : prompt}</small>
      </span>
      <span className="flex" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <IconButton key={n} variant="ghost" role="radio" aria-checked={rating === n} label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setRating(n)} className={cn("-mx-1", n <= rating ? "text-ink" : "text-grey-300")}
            icon={<Star size={22} strokeWidth={1.75} fill={n <= rating ? "currentColor" : "none"} />} />
        ))}
      </span>
    </Card>
  );
}
