import { redirect } from "next/navigation";

export const metadata = { title: "More" };

/** Old overflow menu — setup items moved to Profile. */
export default function MorePage() {
  redirect("/profile");
}
