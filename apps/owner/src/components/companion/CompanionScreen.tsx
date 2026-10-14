"use client";

import { ArrowUp, Lock, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Topbar } from "@river-apps/ui";
import { useAuthGatePrompt } from "@/components/auth/AuthGateProvider";
import { useShop } from "@/lib/shop";
import { PAID_PER_MO } from "@/lib/plans";
import { askCompanion, loadOlder, manilaMonthId, PAGE, PARTNER_MONTHLY_QUESTIONS, refreshTips, watchMessages, watchUsage, type CompanionMessage } from "@/lib/companion";
import { CompanionAvatar } from "./CompanionMark";
import { ShellBack } from "../shell/PageBack";
import { ErrorNote } from "../ui";

const SUGGESTIONS = ["Magkano kinita ko last week?", "Tama ba ₱35/kg sa area ko?", "Promo idea for slow Tuesdays?"];

/** Renders **bold** and line breaks only. */
function Rich({ text }: { text: string }) {
  return <>{text.split("\n").map((ln, i) => <p key={i} className="min-h-[1em]">{ln.split(/(\*\*[^*]+\*\*)/).map((s, j) => s.startsWith("**") ? <b key={j}>{s.slice(2, -2)}</b> : s)}</p>)}</>;
}

function Bubble({ m }: { m: CompanionMessage }) {
  const mine = m.role === "user";
  const text = m.lockedTips ? m.text.split("\n").filter((l) => !l.startsWith("🔒")).join("\n") : m.text;
  const tag = m.kind === "tips" ? "Monday tips" : m.kind === "alert" ? "Heads up" : "";
  return (
    <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {mine ? null : <CompanionAvatar size={26} state="still" />}
      <div className={`max-w-[85%] rounded-[20px] px-3.5 py-2.5 text-[14px] font-medium leading-snug ${mine ? "rounded-br-[6px] bg-ink text-white" : "rounded-bl-[6px] bg-grey-100 text-ink"}`}>
        {tag ? <b className="mb-1 block text-[11.5px] uppercase tracking-[0.04em] text-muted">{tag}</b> : null}
        <Rich text={text} />
        {m.lockedTips ? (
          <div className="mt-2">
            <div aria-hidden className="select-none space-y-1 blur-[5px]">
              {Array.from({ length: m.lockedTips }, (_, i) => <p key={i}>• Mas maraming tips para sa shop mo ngayong linggo, kasama ang pricing at promos.</p>)}
            </div>
            <Button href="/settings/billing" size="sm" className="mt-2" leadingIcon={<Lock size={14} />}>Upgrade to Pro · {PAID_PER_MO}</Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function CompanionScreen() {
  useAuthGatePrompt({ promptOnMount: true, subtitle: "Sign in to chat with your Companion." });
  const { shop, member, source, isGuest } = useShop();
  const live = source.mode === "firebase" && !isGuest;
  const paid = shop.tier === "paid";
  const [recent, setRecent] = useState<CompanionMessage[]>([]);
  const [older, setOlder] = useState<CompanionMessage[]>([]);
  const [moreOlder, setMoreOlder] = useState(true);
  const loadingOlder = useRef(false);
  const msgs = [...older, ...recent];
  const [used, setUsed] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"chat" | "tips" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => (live ? watchMessages(shop.id, (m) => { setRecent(m); if (m.length < PAGE) setMoreOlder(false); }, (e) => setError(e.message)) : undefined), [live, shop.id]);
  // Lazy-load older messages when the owner scrolls to the top of the thread.
  useEffect(() => {
    if (!live) return;
    const onScroll = async () => {
      if (window.scrollY > 40 || loadingOlder.current || !moreOlder || msgs.length === 0) return;
      loadingOlder.current = true;
      const h = document.documentElement.scrollHeight;
      const page = await loadOlder(shop.id, msgs[0].createdAt).catch(() => []);
      if (page.length < PAGE) setMoreOlder(false);
      setOlder((o) => [...page, ...o]);
      requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight - h));
      loadingOlder.current = false;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [live, shop.id, moreOlder, msgs]);
  useEffect(() => (live ? watchUsage(shop.id, manilaMonthId(), (u) => setUsed(u.questions)) : undefined), [live, shop.id]);
  useEffect(() => end.current?.scrollIntoView({ block: "end" }), [recent.length, busy]);

  const left = Math.max(0, PARTNER_MONTHLY_QUESTIONS - used);
  const out = !paid && left === 0;
  const owner = member.role === "owner";

  async function send(q: string) {
    const t = q.trim();
    if (!t || busy || !live) return;
    setBusy("chat"); setError(null); setText("");
    try { await askCompanion(t); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setText(t); } finally { setBusy(null); }
  }
  async function tips() {
    setBusy("tips"); setError(null);
    try { await refreshTips(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(null); }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-4 pt-3">
      <Topbar className="px-0" leading={<ShellBack />} title={<span className="inline-flex items-center gap-2"><CompanionAvatar size={26} state={busy ? "thinking" : "idle"} />Companion</span>}
        subtitle={paid ? "Your laundry business buddy" : `${left} of ${PARTNER_MONTHLY_QUESTIONS} questions left this month`}
        actions={live && owner ? <button type="button" aria-label="Get this week's tips" title="Get this week's tips" disabled={!!busy} onClick={() => void tips()} className="inline-flex size-10 items-center justify-center rounded-full bg-grey-100 disabled:opacity-50"><RefreshCw size={17} className={busy === "tips" ? "animate-spin" : ""} /></button> : null} />

      <div className="flex flex-1 flex-col gap-2.5 py-3">
        {msgs.length === 0 && !busy ? (
          <div className="my-auto text-center">
            <div className="flex justify-center"><CompanionAvatar size={64} state={busy ? "thinking" : "idle"} /></div>
            <p className="mt-2 text-[15px] font-bold">Hi! Ako si Labby.</p>
            <p className="mt-0.5 text-[13.5px] font-medium text-muted">Ask about your sales, or pricing, promos and staffing.</p>
          </div>
        ) : msgs.map((m) => <Bubble key={m.id} m={m} />)}
        {busy ? <div className="flex items-center gap-2"><CompanionAvatar size={26} state="thinking" /><p className="text-[13px] font-semibold text-muted">{busy === "tips" ? "Gumagawa ng tips…" : "Nag-iisip…"}</p></div> : null}
        <div ref={end} />
      </div>

      {error ? <ErrorNote className="mb-2">{error}</ErrorNote> : null}
      <div className="sticky bottom-0 bg-canvas pb-[max(12px,env(safe-area-inset-bottom))] pt-1">
        {msgs.length === 0 ? (
          <div className="mb-2 flex gap-2 overflow-x-auto">
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => void send(s)} disabled={!live || out || !!busy} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50">{s}</button>)}
          </div>
        ) : null}
        {out ? (
          <Button href="/settings/billing" fullWidth size="md">Upgrade to Pro · {PAID_PER_MO} for unlimited chat</Button>
        ) : (
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} disabled={!live || !owner}
              placeholder={live ? (owner ? "Ask Labby…" : "Owner only") : "Sign in to chat"} aria-label="Message"
              className="h-12 min-w-0 flex-1 rounded-full bg-grey-100 px-4 text-[15px] font-medium outline-none" />
            <button type="submit" aria-label="Send" disabled={!text.trim() || !!busy || !live} className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white disabled:opacity-40"><ArrowUp size={20} /></button>
          </form>
        )}
      </div>
    </div>
  );
}
