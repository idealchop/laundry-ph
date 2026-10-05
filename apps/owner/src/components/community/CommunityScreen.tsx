"use client";

import { Heart, MessageCircle, Plus } from "lucide-react";
import { Avatar, Button, Card, Topbar } from "@river-apps/ui";

type SamplePost = {
  id: string;
  author: string;
  handle: string;
  avatar: "sky" | "rose" | "mint" | "butter" | "lilac" | "peach" | "indigo";
  time: string;
  body: string;
  likes: number;
  replies: number;
};

const SAMPLE_POSTS: SamplePost[] = [
  {
    id: "p1",
    author: "Marites Laundry",
    handle: "marites.pasig",
    avatar: "rose",
    time: "2h",
    body: "Tip: batch fold while the next load dries — cuts afternoon rush by half. Who else does this?",
    likes: 24,
    replies: 6,
  },
  {
    id: "p2",
    author: "Kapitolyo Wash",
    handle: "kapitolyo.wash",
    avatar: "sky",
    time: "5h",
    body: "Looking for a reliable rider for River Mobile pickups in Pasig / Mandaluyong. Drop a rec below.",
    likes: 11,
    replies: 9,
  },
  {
    id: "p3",
    author: "Fresh Cycle Co.",
    handle: "freshcycle",
    avatar: "mint",
    time: "Yesterday",
    body: "We just posted our shop photos for the River Mobile listing. Excited for Partner Phase 2!",
    likes: 38,
    replies: 4,
  },
  {
    id: "p4",
    author: "Laundry.ph",
    handle: "laundry.ph",
    avatar: "indigo",
    time: "2d",
    body: "Community feed preview — this will connect to the River Mobile community so shop owners can share ops tips, hire help, and swap supplier finds.",
    likes: 56,
    replies: 12,
  },
];

/** Threads-style community feed stub — will connect to River Mobile community. */
export function CommunityScreen() {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[680px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="Community"
        subtitle={
          <>
            River Mobile community · coming soon
          </>
        }
      />

      <Card className="mt-4 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <Avatar name="You" preset="butter" size={40} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-medium text-muted">Share a tip with other laundry shops…</p>
            <Button className="mt-2.5" size="sm" variant="secondary" disabled leadingIcon={<Plus size={16} strokeWidth={2} />}>
              Post (soon)
            </Button>
          </div>
        </div>
      </Card>

      <p className="mt-3 px-1 text-[12.5px] font-semibold text-muted">
        Posts below are a preview — this feed will connect to the River Mobile community.
      </p>

      <ul className="mt-3 flex flex-col gap-2.5" aria-label="Community posts">
        {SAMPLE_POSTS.map((p) => (
          <li key={p.id}>
            <Card className="px-4 py-3.5">
              <div className="flex gap-3">
                <Avatar name={p.author} preset={p.avatar} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <b className="text-[14.5px] font-extrabold tracking-[-0.01em]">{p.author}</b>
                    <span className="text-[13px] font-semibold text-muted">@{p.handle}</span>
                    <span className="text-[12.5px] font-semibold text-subtle">· {p.time}</span>
                    
                  </div>
                  <p className="mt-1.5 text-[15px] font-medium leading-snug text-ink">{p.body}</p>
                  <div className="mt-3 flex items-center gap-4 text-muted">
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold">
                      <Heart size={16} strokeWidth={1.75} aria-hidden /> {p.likes}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold">
                      <MessageCircle size={16} strokeWidth={1.75} aria-hidden /> {p.replies}
                    </span>
                  </div>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
