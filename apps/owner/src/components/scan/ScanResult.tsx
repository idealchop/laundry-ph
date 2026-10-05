import { MapPin } from "lucide-react";
import { DetergentIcon, Icon3D, LaundryBasketIcon } from "@river-apps/icons";
import { Avatar, Card, IconTile, ListItem, MonoText, StatusDot, SuccessState } from "@river-apps/ui";
import type { VerifiedBooking } from "@/data";
import { peso } from "@/lib/format";
import { FocusHeader, FocusSurface } from "../FocusHeader";
import { ScanActions } from "./ScanActions";

/** Result of scanning a River Mobile customer's QR. */
export function ScanResult({ booking }: { booking: VerifiedBooking }) {
  const addOnTotal = booking.addOns.reduce((s, a) => s + a.price, 0);
  const total = booking.estimate + addOnTotal + booking.pickup.fee;
  return (
    <FocusSurface style={{ background: "linear-gradient(180deg,#F2F2F4 0%,#fff 46%)" }}>
      <FocusHeader title="Scan result" backHref="/partner" variant="close" />
      <SuccessState className="-mt-3 px-6" title="Customer verified" description={`${booking.source} booking · ${booking.checkedIn}`} />
      <Card padding="sm" className="mx-5 mt-4 flex items-center gap-3 p-3.5">
        <Avatar name={booking.customer.name} preset={booking.customer.avatar} size={48} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5"><b className="text-[16px]">{booking.customer.name}</b><StatusDot>{booking.source} customer</StatusDot></span>
        <MonoText inverse className="text-[14px]">{booking.ref}</MonoText>
      </Card>
      <div className="mx-5 mt-2.5 grid grid-cols-2 gap-2.5">
        {[
          { i: <Icon3D name={booking.serviceIcon} size={34} />, k: "Service", v: booking.serviceName },
          { i: <LaundryBasketIcon size={34} />, k: "Estimate", v: `About ${booking.estimateKg} kg · ${peso(booking.estimate)}` },
        ].map((t) => (
          <Card key={t.k} tone="muted" radius="panel" padding="none" className="flex flex-col gap-0.5 rounded-[22px] p-3.5">
            <span className="mb-1.5">{t.i}</span>
            <small className="text-[12px] font-semibold text-muted">{t.k}</small>
            <b className="text-[15px] tracking-[-0.01em]">{t.v}</b>
          </Card>
        ))}
      </div>
      <Card tone="muted" radius="panel" padding="none" className="mx-5 mt-2.5 rounded-[22px] px-3.5 py-1.5">
        <ListItem variant="row" leading={<IconTile tone="white" size={44}><DetergentIcon size={30} /></IconTile>} title="Add-ons"
          subtitle={booking.addOns.map((a) => a.name).join(" · ")} trailing={<b className="text-[14px] font-extrabold">+{peso(addOnTotal)}</b>} />
        <ListItem variant="row" leading={<IconTile tone="white" size={44}><MapPin size={20} strokeWidth={1.75} /></IconTile>} title={`Pickup ${booking.pickup.window}`}
          subtitle={booking.pickup.address} trailing={<b className="text-[14px] font-extrabold">+{peso(booking.pickup.fee)}</b>} />
      </Card>
      <ScanActions total={peso(total)} bookingRef={booking.ref} />
    </FocusSurface>
  );
}
