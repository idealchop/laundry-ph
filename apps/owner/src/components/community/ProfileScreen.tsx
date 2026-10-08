"use client";

import { BadgeCheck, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, cn } from "@river-apps/ui";
import { PostCard } from "./PostCard";
import { useCommunityFeed } from "./feed";
import { authorHandle, resolveProfile, type CommunityPost } from "./posts";

type Tab = "threads" | "replies" | "media" | "reposts";

const TABS: { id: Tab; label: string }[] = [
  { id: "threads", label: "Threads" },
  { id: "replies", label: "Replies" },
  { id: "media", label: "Media" },
  { id: "reposts", label: "Reposts" },
];

/** Threads-style profile for one community shop. */
export function ProfileScreen() {
  const handle = (useSearchParams().get("u") ?? "").toLowerCase();
  const feed = useCommunityFeed();
  const profile = resolveProfile(handle, feed.me);
  const [tab, setTab] = useState<Tab>("threads");
  const isMe = !!profile && authorHandle(feed.me.name) === profile.handle;
  const following = !!profile && feed.following.includes(profile.handle);

  const byAuthor = (p: CommunityPost) => !!profile && authorHandle(p.author.name) === profile.handle;
  const threads = feed.posts.filter(byAuthor);
  const replies = feed.posts.flatMap((p) =>
    p.replies.filter((r) => profile && authorHandle(r.author.name) === profile.handle).map((reply) => ({ reply, parent: p })),
  );
  const media = threads.flatMap((p) => p.images.map((src) => ({ src, postId: p.id })));
  const reposts = isMe ? feed.posts.filter((p) => p.reposted) : [];

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-[max(0.5rem,env(safe-area-inset-top))] lg:max-w-[640px] lg:px-[30px] lg:pt-6">
      <Link
        href="/community"
        aria-label="Back to community"
        className="inline-flex size-10 items-center justify-center rounded-full text-ink hover:bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink"
      >
        <ChevronLeft size={24} strokeWidth={1.75} />
      </Link>

      {!profile ? (
        <p className="px-1 py-16 text-center text-[15px] font-semibold text-muted">That profile isn’t in the community.</p>
      ) : (
        <>
          <header className="mt-2 px-1">
            <Avatar
              name={profile.name}
              preset={profile.photoUrl ? undefined : profile.avatar}
              src={profile.photoUrl}
              size={86}
              decorative={false}
            />
            <h1 className="mt-3 flex items-center gap-1.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
              <span className="min-w-0 truncate">{profile.name}</span>
              {profile.verified ? <BadgeCheck size={20} strokeWidth={2.2} className="flex-none fill-[#0095F6] text-white" aria-label="Verified" /> : null}
            </h1>
            <p className="mt-0.5 text-[15px] font-medium text-muted">{profile.handle}</p>
            <p className="mt-3 max-w-[440px] text-[15px] font-medium leading-snug text-ink">{profile.bio}</p>
            <p className="mt-3 text-[15px] text-muted">
              <b className="font-bold text-ink">{groupDigits(profile.followers + (following ? 1 : 0))}</b> followers
            </p>
            {isMe ? null : (
              <button
                type="button"
                aria-pressed={following}
                onClick={() => feed.toggleFollow(profile.handle)}
                className={cn(
                  "mt-4 h-11 w-full rounded-pill text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink sm:w-auto sm:min-w-[140px] sm:px-8",
                  following ? "bg-grey-100 text-ink" : "bg-ink text-on-ink",
                )}
              >
                {following ? "Following" : "Follow"}
              </button>
            )}
          </header>

          <div role="tablist" aria-label="Profile" className="-mx-4 mt-5 flex border-b border-line lg:-mx-[30px]">
            {TABS.map((t) => {
              const on = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "-mb-px flex-1 border-b-2 py-3 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-ink",
                    on ? "border-ink text-ink" : "border-transparent text-muted",
                  )}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {tab === "threads" ? (
            <PostList posts={threads} empty="No threads yet" feed={feed} />
          ) : null}
          {tab === "replies" ? (
            replies.length ? (
              <ul className="divide-y divide-line" aria-label="Replies">
                {replies.map(({ reply, parent }) => (
                  <li key={reply.id} className="px-1 py-4">
                    <p className="text-[13px] font-semibold text-muted">Replying to {parent.author.name}</p>
                    <p className="mt-1.5 whitespace-pre-line text-[15px] font-medium leading-snug text-ink">{reply.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label="No replies yet" />
            )
          ) : null}
          {tab === "media" ? (
            media.length ? (
              <ul className="-mx-4 grid grid-cols-3 gap-0.5 lg:-mx-[30px]" aria-label="Media">
                {media.map((m) => (
                  <li key={`${m.postId}-${m.src}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setTab("threads");
                        requestAnimationFrame(() => document.getElementById(m.postId)?.scrollIntoView({ block: "start" }));
                      }}
                      className="block aspect-square w-full overflow-hidden bg-grey-100 focus-visible:outline-2 focus-visible:outline-ink"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.src} alt="" className="size-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty label="No media yet" />
            )
          ) : null}
          {tab === "reposts" ? (
            <PostList posts={reposts} empty="No reposts yet" feed={feed} />
          ) : null}
        </>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center lg:bottom-8">
        {feed.toast ? <span className="rounded-pill bg-ink px-4 py-2.5 text-[14px] font-bold text-on-ink shadow-raised">{feed.toast}</span> : null}
      </div>
    </div>
  );
}

function groupDigits(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function Empty({ label }: { label: string }) {
  return <p className="px-1 py-14 text-center text-[15px] font-semibold text-muted">{label}</p>;
}

function PostList({ posts, empty, feed }: { posts: CommunityPost[]; empty: string; feed: ReturnType<typeof useCommunityFeed> }) {
  if (!posts.length) return <Empty label={empty} />;
  return (
    <ul className="divide-y divide-line" aria-label="Threads">
      {posts.map((p) => (
        <li key={p.id} id={p.id} className="scroll-mt-20">
          <PostCard
            post={p}
            now={feed.now}
            me={feed.me}
            onLike={() => feed.like(p.id)}
            onRepost={() => feed.repost(p)}
            onShare={() => void feed.share(p)}
            onReply={(body) => feed.reply(p, body)}
            onDelete={p.mine ? () => feed.remove(p) : undefined}
            onHide={() => feed.hide(p.id)}
            onCopy={() => feed.copy(p)}
          />
        </li>
      ))}
    </ul>
  );
}
