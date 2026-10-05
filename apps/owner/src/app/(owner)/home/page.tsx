import { HomeScreen } from "@/components/home/HomeScreen";

export const metadata = { title: "Home" };

/** Paid home on phones; Growth Dashboard from the `lg` breakpoint up. Live Firestore data. */
export default function HomePage() {
  return <HomeScreen />;
}
