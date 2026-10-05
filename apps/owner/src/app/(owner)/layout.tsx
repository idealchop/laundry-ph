import { RequireAuth } from "@/components/RequireAuth";
import { ShopGate } from "@/components/ShopGate";
import { OwnerShell } from "@/components/shell/OwnerShell";
import { ShopProvider } from "@/lib/shop";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <ShopProvider>
        <ShopGate>
          <OwnerShell>{children}</OwnerShell>
        </ShopGate>
      </ShopProvider>
    </RequireAuth>
  );
}
