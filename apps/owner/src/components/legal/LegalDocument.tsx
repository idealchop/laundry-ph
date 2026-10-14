import Link from "next/link";
import { LEGAL_DRAFT_NOTICE, type LegalBlock, type LegalDoc } from "@/data/legal";

/** Renders "<b>Lead:</b> rest" as a bold lead-in. Content is static, from src/data/legal.ts. */
function Rich({ text }: { text: string }) {
  const m = /^<b>(.*?)<\/b>\s*(.*)$/.exec(text);
  if (!m) return <>{text}</>;
  return (<><b className="font-bold text-ink">{m[1]}</b> {m[2]}</>);
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p className="mt-2"><Rich text={block} /></p>;
  return (
    <ul className="mt-2 list-disc space-y-1.5 pl-5">
      {block.list.map((item, i) => <li key={i}><Rich text={item} /></li>)}
    </ul>
  );
}

/** Public legal page: readable at 390px, no sign-in needed. */
export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const other = doc.slug === "terms" ? { href: "/privacy", label: "Privacy Policy" } : { href: "/terms", label: "Terms of Service" };
  return (
    <main className="mx-auto min-h-dvh max-w-[680px] bg-surface px-5 pb-16 pt-5 text-[14.5px] leading-[1.6] text-muted">
      <Link href="/home" className="text-[13px] font-bold text-ink">← Laundry.ph</Link>
      <h1 className="mt-4 text-[27px] font-extrabold leading-tight tracking-[-0.025em] text-ink">{doc.title}</h1>
      <p className="mt-1 text-[13px] font-semibold">{doc.effective}</p>
      <p className="mt-3 rounded-[14px] bg-grey-100 px-3.5 py-2.5 text-[13px] font-semibold text-ink">{LEGAL_DRAFT_NOTICE}</p>
      {doc.intro.map((t, i) => <p key={i} className="mt-3">{t}</p>)}
      <nav aria-label="Contents" className="mt-5 rounded-[18px] border border-line p-4">
        <b className="text-[13px] text-ink">Contents</b>
        <ol className="mt-2 space-y-1 text-[13.5px] font-semibold">
          {doc.sections.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-ink underline-offset-2 hover:underline">{s.title}</a></li>)}
        </ol>
      </nav>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id} className="mt-7 scroll-mt-4">
          <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink">{s.title}</h2>
          {s.blocks.map((b, i) => <Block key={i} block={b} />)}
        </section>
      ))}
      <p className="mt-10 border-t border-line pt-4 text-[13px] font-semibold">
        See also our <Link href={other.href} className="text-ink underline">{other.label}</Link>.
      </p>
    </main>
  );
}
