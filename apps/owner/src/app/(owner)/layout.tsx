import { ShopGate } from "@/components/ShopGate";
import { OwnerShell } from "@/components/shell/OwnerShell";
import { ShopProvider } from "@/lib/shop";

/**
 * Owner dashboard is browseable without Firebase Auth (guest sample shop).
 * Mutations open AuthGateSheet via useAction / requireAuth — no RequireAuth wall.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopProvider>
      <ShopGate>
        <OwnerShell>{children}</OwnerShell>
      </ShopGate>
    </ShopProvider>
  );
}
