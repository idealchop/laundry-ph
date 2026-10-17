"use client";

import { Button, Card, Topbar } from "@river-apps/ui";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { bookingUrl } from "@/lib/shop-qr";
import { useLocationFilter } from "@/lib/shop-locations";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";
import { ShellBack } from "../shell/PageBack";
import { HowBookingWorks } from "./HowBookingWorks";

/** Paid shop page: one QR customers scan to book. */
export function QrCodesScreen() {
  const { shop } = useShop();
  const shops = useLocationFilter();
  const [origin, setOrigin] = useState("");
  const [src, setSrc] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => queueMicrotask(() => setOrigin(window.location.origin)), []);

  const locationId = shops.enabled && shops.scopeId ? shops.scopeId : undefined;
  const url = origin && !shops.viewingAll ? bookingUrl(origin, shop.id, locationId) : "";
  const who = shops.enabled && shops.branch ? `${shop.name} · ${shops.branch.name}` : shop.name;

  useEffect(() => {
    if (!url) return;
    let live = true;
    void QRCode.toDataURL(url, { margin: 1, width: 280, color: { dark: "#0A0A0A", light: "#FFFFFF" } }).then((data) => {
      if (live) setSrc(data);
    });
    return () => { live = false; };
  }, [url]);

  const copy = () => {
    if (!url) return;
    void navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-8 pt-4 lg:max-w-[960px] lg:px-[30px] lg:pt-6">
      <Topbar
        className="px-1"
        leading={<ShellBack />}
        title="QR code"
        subtitle={<>{shops.viewingAll ? "Open one shop in Profile → Shops. Each shop has its own QR." : `Customers scan this for ${who}`} <SampleNote className="ml-1 align-middle" /></>}
      />
      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
        <Card className="flex flex-col items-center px-4 py-5 text-center">
          <b className="text-[16px]">Booking</b>
          <p className="mt-1 max-w-[280px] text-[13px] font-medium text-muted">{shops.viewingAll ? "This code stays blank until one shop is open." : `One code for ${who}.`}</p>
          <div className="mt-4 rounded-tile bg-surface p-3 ring-1 ring-grey-200">
            {url && src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="Booking QR code" width={220} height={220} className="size-[220px]" />
            ) : (
              <span className="block size-[220px]" aria-hidden />
            )}
          </div>
          <p className="mt-3 max-w-full break-all font-mono text-[12px] font-semibold text-muted">{url || " "}</p>
          {shops.viewingAll ? <Button size="sm" className="mt-3" href="/settings/shops">Shops</Button> : (
            <Button size="sm" variant="secondary" className="mt-3" disabled={!url} onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </Button>
          )}
        </Card>
        <Card className="px-5 py-5">
          <HowBookingWorks />
        </Card>
      </div>
    </div>
  );
}
