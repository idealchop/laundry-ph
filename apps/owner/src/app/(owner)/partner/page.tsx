import { PartnerHome } from "@/components/partner/PartnerHome";
import { data } from "@/data";

export const metadata = { title: "Partner home" };

export default async function PartnerPage() {
  const [shop, today, schedule, requests] = await Promise.all([data.getShop(), data.getTodaySummary(), data.getSchedule(), data.getPickupRequests()]);
  return <PartnerHome shop={shop} today={today} schedule={schedule} requests={requests} />;
}
