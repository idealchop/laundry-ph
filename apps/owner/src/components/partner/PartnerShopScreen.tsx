"use client";

import { MapPin } from "lucide-react";
import { Badge, Button, Card, EmptyState, ListItem, Topbar } from "@river-apps/ui";
import { Icon3D } from "@river-apps/icons";
import { useShop } from "@/lib/shop";
import { SampleNote } from "../SampleNote";

function formatAddress(shop: ReturnType<typeof useShop>["shop"]): string | null {
  const a = shop.address;
  if (!a) return shop.location?.formattedAddress || null;
  return [a.line1, a.line2, a.barangay, a.city, a.province, a.postalCode].filter(Boolean).join(", ");
}

/** Partner shop listing preview — uses saved address + map pin from Settings. */
export function PartnerShopScreen() {
  const { shop } = useShop();
  const address = formatAddress(shop);
  const pin = shop.location;

  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pb-6 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title="Shop listing" subtitle={<>What River Mobile customers will see <SampleNote className="ml-1 align-middle" /></>} />

      <Card className="mt-4 px-4 py-3.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <b className="text-[18px]">{shop.name}</b>
            <p className="mt-0.5 text-[13.5px] font-medium text-muted">{shop.area || "Area not set"}</p>
          </div>
          <Badge variant={shop.tier === "paid" ? "solid" : "soft"}>{shop.tier === "paid" ? "Paid shop" : "Partner"}</Badge>
        </div>

        {address ? (
          <ListItem
            className="mt-3"
            variant="row"
            leading={<MapPin size={20} strokeWidth={1.75} className="text-ink" />}
            title={address}
            subtitle={pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "No map pin yet"}
          />
        ) : (
          <EmptyState
            className="mt-3 border-0 py-6"
            illustration={<Icon3D name="washer" size={64} />}
            title="Add your address"
            description="River Mobile needs a street address and map pin to list your shop nearby."
            action={<Button href="/settings" size="md">Open settings</Button>}
          />
        )}

        {pin ? (
          <div className="mt-3 overflow-hidden rounded-[18px] border border-grey-200">
            <iframe
              title="Listing map"
              className="h-[180px] w-full border-0"
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${pin.lng - 0.01}%2C${pin.lat - 0.01}%2C${pin.lng + 0.01}%2C${pin.lat + 0.01}&layer=mapnik&marker=${pin.lat}%2C${pin.lng}`}
            />
          </div>
        ) : null}
      </Card>

      <Card className="mt-4 px-4 py-3.5">
        <b className="text-[16px]">Coming in Phase 2</b>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] font-medium text-muted">
          <li>Hours, photos and service / kilo prices on River Mobile</li>
          <li>Pause listing when the shop is full</li>
          <li>Live sync through the Partner API</li>
        </ul>
        <Button className="mt-3" href="/settings" variant="secondary" size="md">Edit address & pin</Button>
      </Card>
    </div>
  );
}
