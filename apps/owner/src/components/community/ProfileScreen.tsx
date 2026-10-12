"use client";

import { BadgeCheck, Star } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar, cn } from "@river-apps/ui";
import { PostCard } from "./PostCard";
import { useCommunityFeed } from "./feed";
import { locationCount, locationCountLabel } from "@/lib/format";
import { useShop } from "@/lib/shop";
import { useShopMark } from "@/lib/shop-mark";
import { useShopLocations } from "@/lib/shop-locations";
import { ShellBack } from "../shell/PageBack";
import { authorHandle, resolveProfile, type CommunityPost, type CommunityProfile } from "./posts";

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
  const { shop } = useShop();
  const shops = useShopLocations();
  const mark = useShopMark(shop.id, Math.max(1, locationCount(shop.area, Boolean(shop.location))));
  const profile = resolveProfile(handle, feed.me, { hasPin: feed.hasPin });
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
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-2 lg:max-w-[640px] lg:px-[30px] lg:pt-2">
      {!profile ? (
        <div className="px-1 py-6">
          <ShellBack />
          <p className="py-10 text-center text-[15px] font-semibold text-muted">That profile isn’t in the community.</p>
        </div>
      ) : (
        <>
          <header className="mt-3 px-1">
            <div className="flex items-center gap-3">
              <ShellBack />
              <Avatar
                name={profile.name}
                preset={(isMe && mark.logoUrl) || profile.photoUrl ? undefined : profile.avatar}
                src={isMe && mark.logoUrl ? mark.logoUrl : profile.photoUrl}
                size={84}
                decorative={false}
              />
            </div>
            <h1 className="mt-4 text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] text-ink">
              {profile.name}
              {profile.verified ? <BadgeCheck size={20} strokeWidth={2.2} className="ml-1.5 inline-block -translate-y-0.5 fill-[#0095F6] text-white" aria-label="Verified" /> : null}
            </h1>
            <p className="mt-1 text-[15px] font-medium text-muted">@{profile.handle}</p>
            <p className="mt-4 max-w-[440px] text-[16px] font-medium leading-snug text-ink">{profile.bio}</p>
            <ProfileFacts
              profile={profile}
              followers={profile.followers + (following ? 1 : 0)}
              locations={isMe ? (shops.enabled ? Math.max(1, shops.branches.length) : mark.locations) : undefined}
            />
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

/** Rating and location count, then followers. Same stack as the community profile header. */
function ProfileFacts({ profile, followers, locations: locationsOverride }: { profile: CommunityProfile; followers: number; locations?: number }) {
  const locations = locationsOverride ?? locationCount(profile.meta, profile.hasPin);
  const rating = profile.rating != null ? profile.rating.toFixed(1) : null;
  return (
    <>
      {rating || locations > 0 ? (
        <p
          className="mt-4 flex items-center text-[15px] leading-none"
          aria-label={[rating ? `Rated ${rating} out of 5` : "", locations > 0 ? locationCountLabel(locations) : ""].filter(Boolean).join(", ")}
        >
          {rating ? (
            <>
              <Star size={15} strokeWidth={2.25} className="mr-1.5 fill-ink text-ink" aria-hidden />
              <span className="font-extrabold tracking-[-0.02em] text-ink">{rating}</span>
            </>
          ) : null}
          {locations > 0 ? <span className="font-medium text-muted">{rating ? " · " : ""}{locationCountLabel(locations)}</span> : null}
        </p>
      ) : null}
      <p className="mt-4 text-[15px] leading-none text-muted">
        <b className="font-extrabold text-ink">{groupDigits(followers)}</b> followers
      </p>
    </>
  );
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
