import { Button } from "@river-apps/ui";
import { LaundryScene } from "../brand";

/** Same QR card as the desktop sidebar: illustration, short line, and a button to the QR page. */
export function ShopQrPromo({ className = "" }: { className?: string }) {
  return (
    <div className={`relative rounded-[22px] bg-grey-100 px-4 pb-4 pt-[78px] ${className}`}>
      <div className="absolute inset-x-0 -top-9 flex justify-center"><LaundryScene size={150} /></div>
      <b className="block text-[14.5px]">Shop QR code</b>
      <small className="mb-3 mt-0.5 block text-[12.5px] font-semibold text-ink/55">Customers scan to book</small>
      <Button size="sm" fullWidth href="/qr">Get QR code</Button>
    </div>
  );
}
