import { Suspense } from "react";
import { AppLoader } from "@/components/common/AppLoader";
import { ManageShopScreen } from "@/components/settings/ManageShopScreen";

export const metadata = { title: "Manage Shop" };

/** One location: details, pin, staff link (`/settings/shops/edit?id=<branchId>`). */
export default function ManageShopPage() {
  return <Suspense fallback={<AppLoader />}><ManageShopScreen /></Suspense>;
}
