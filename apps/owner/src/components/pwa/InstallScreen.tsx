"use client";
import { CoinIcon } from "@river-apps/icons";
import { InstallPanel } from "./InstallPanel";
import { RiverIcon } from "@/components/common/RiverIcon";
import { FocusHeader } from "@/components/FocusHeader";

const FEATURES = [
  { art: <RiverIcon name="cleaning" size={30} />, text: "Run your laundry shop from your phone" },
  { art: <RiverIcon name="bookings" size={30} />, text: "Take walk-ins and River Mobile pickups" },
  { art: <CoinIcon size={30} />, text: "Track sales, supplies and staff performance" },
];

/** Settings › Install app: Laundry.ph on the owner's home screen (opens /home). */
export function InstallScreen() {
  return (
    <>
      <FocusHeader title="" backHref="/profile" />
      <main className="mx-auto w-full max-w-[460px] px-4 pb-10">
        <InstallPanel features={FEATURES} />
      </main>
    </>
  );
}

export const STAFF_FEATURES = [
  { art: <RiverIcon name="cleaning" size={30} />, text: "Open your shop's counter in one tap" },
  { art: <RiverIcon name="orders" size={30} />, text: "Add walk-ins and move orders along" },
  { art: <RiverIcon name="staff" size={30} />, text: "See your walk-ins today" },
];
