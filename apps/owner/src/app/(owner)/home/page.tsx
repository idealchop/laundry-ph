import { GrowthDashboard } from "@/components/home/GrowthDashboard";
import { PaidHomeMobile } from "@/components/home/PaidHomeMobile";
import { data } from "@/data";

export const metadata = { title: "Home" };

/** Paid home on phones; Growth Dashboard from the `lg` breakpoint up. */
export default async function HomePage() {
  const [shop, today, machines, queue, stats, tip, week, customers] = await Promise.all([
    data.getShop(), data.getTodaySummary(), data.getMachines(), data.getOrderQueue(),
    data.getGrowthStats(), data.getGrowthTip(), data.getWeekSales(), data.getCustomers(),
  ]);
  return (
    <>
      <div className="lg:hidden"><PaidHomeMobile shop={shop} today={today} machines={machines} queue={queue} /></div>
      <div className="hidden lg:block"><GrowthDashboard shop={shop} today={today} stats={stats} tip={tip} week={week} queue={queue} customers={customers} /></div>
    </>
  );
}
