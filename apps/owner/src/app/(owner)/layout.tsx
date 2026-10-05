import { RequireAuth } from "@/components/RequireAuth";
import { OwnerShell } from "@/components/shell/OwnerShell";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <OwnerShell>{children}</OwnerShell>
    </RequireAuth>
  );
}
