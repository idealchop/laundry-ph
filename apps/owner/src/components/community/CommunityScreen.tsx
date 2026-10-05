"use client";

import { SquarePen } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button, Card, Topbar } from "@river-apps/ui";
import { useShop } from "@/lib/shop";
import { Composer, type ComposerHandle } from "./Composer";
import { PostCard } from "./PostCard";
import { SEED_POSTS, updateCommunityStore, useCommunityStore, useNow, type CommunityPost, type CommunityStore, type PostAuthor, type PostReply } from "./posts";

/**
 * River Apps community for laundry shop owners. Single-column feed with large
 * Facebook-style photos. Demo posts + your own posts, saved on this device.
 */
export function CommunityScreen() {
  const { shop } = useShop();
  const me: PostAuthor = useMemo(
    () => ({ name: shop.name, meta: shop.area || undefined, avatar: shop.ownerAvatar, photoUrl: shop.photoUrls?.[0] }),
    [shop.name, shop.area, shop.ownerAvatar, shop.photoUrls],
  );

  const store = useCommunityStore();
  const now = useNow();
  const [toast, setToast] = useState<string | null>(null);
  const composerRef = useRef<ComposerHandle>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const update = (fn: (s: CommunityStore) => CommunityStore, done?: string) => {
    const ok = updateCommunityStore(fn);
    if (!ok) flash("Storage is full on this device. Try fewer or smaller photos.");
    else if (done) flash(done);
    return ok;
  };

  const posts = useMemo(() => {
    const hidden = new Set(store.hidden);
    const liked = new Set(store.liked);
    const reposted = new Set(store.reposted);
    return [...store.mine, ...SEED_POSTS]
      .filter((p) => !hidden.has(p.id))
      .map((p) => {
        const isLiked = liked.has(p.id);
        const isReposted = reposted.has(p.id);
        return {
          ...p,
          liked: isLiked,
          reposted: isReposted,
          likes: p.likes + (isLiked ? 1 : 0),
          reposts: p.reposts + (isReposted ? 1 : 0),
          replies: [...p.replies, ...(store.replies[p.id] ?? [])],
        };
      });
  }, [store]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const share = async (p: CommunityPost) => {
    const url = `${window.location.origin}/community#${p.id}`;
    const text = p.body ? `${p.author.name}: ${p.body.slice(0, 140)}` : `Post by ${p.author.name}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Laundry.ph Community", text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      /* share sheet dismissed */
    }
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[640px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        title="Community"
        subtitle="River Apps · laundry shop owners"
        actions={
          <Button size="sm" variant="secondary" pill leadingIcon={<SquarePen size={16} strokeWidth={2} />} onClick={() => composerRef.current?.focus()}>
            New post
          </Button>
        }
      />

      <Card padding="none" className="mt-4 overflow-hidden">
        <Composer ref={composerRef} me={me} onPost={(body, images) => {
          const post: CommunityPost = {
            id: `mine-${Date.now().toString(36)}`,
            author: me,
            body,
            images,
            createdAt: Date.now(),
            likes: 0,
            reposts: 0,
            replies: [],
            mine: true,
          };
          return update((st) => ({ ...st, mine: [post, ...st.mine] }), "Posted");
        }} />
      </Card>

      <Card padding="none" className="mt-3 overflow-hidden">
        <ul className="divide-y divide-line" aria-label="Community posts">
          {posts.map((p) => (
            <li key={p.id} id={p.id} className="scroll-mt-20">
              <PostCard
                post={p}
                now={now}
                me={me}
                onLike={() => update((st) => ({ ...st, liked: toggle(st.liked, p.id) }))}
                onRepost={() => {
                  update((st) => ({ ...st, reposted: toggle(st.reposted, p.id) }), p.reposted ? undefined : "Reposted");
                }}
                onShare={() => void share(p)}
                onReply={(body) => {
                  const r: PostReply = { id: `r-${Date.now().toString(36)}`, author: me, body, createdAt: Date.now() };
                  update((st) => ({ ...st, replies: { ...st.replies, [p.id]: [...(st.replies[p.id] ?? []), r] } }));
                }}
                onDelete={p.mine ? () => {
                  update((st) => ({ ...st, mine: st.mine.filter((x) => x.id !== p.id) }), "Post deleted");
                } : undefined}
                onHide={() => {
                  update((st) => ({ ...st, hidden: [...st.hidden, p.id] }), "Post hidden");
                }}
                onCopy={() => {
                  void navigator.clipboard?.writeText(p.body).then(() => flash("Copied"), () => undefined);
                }}
              />
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-4 text-center text-[13px] font-semibold text-muted">You’re all caught up</p>
      </Card>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(6.75rem+env(safe-area-inset-bottom))] z-[70] flex justify-center lg:bottom-8">
        {toast ? <span className="rounded-pill bg-ink px-4 py-2.5 text-[14px] font-bold text-on-ink shadow-raised">{toast}</span> : null}
      </div>
    </div>
  );
}
