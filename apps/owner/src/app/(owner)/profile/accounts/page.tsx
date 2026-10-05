import { redirect } from "next/navigation";

export const metadata = { title: "Credits" };

/** Credits moved under Profile hub — keep URL from breaking old links. */
export default function AccountsPage() {
  redirect("/profile");
}
