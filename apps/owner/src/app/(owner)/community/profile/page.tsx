import { Suspense } from "react";
import { ProfileScreen } from "@/components/community/ProfileScreen";

export const metadata = { title: "Profile" };

/** Community profile (`/community/profile?u=<handle>`). A query param keeps the static export working. */
export default function CommunityProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileScreen />
    </Suspense>
  );
}
