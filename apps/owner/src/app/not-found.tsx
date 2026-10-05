import { LaundryBasketIcon } from "@river-apps/icons";
import { Button, EmptyState } from "@river-apps/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] items-center px-4">
      <EmptyState className="w-full" illustration={<LaundryBasketIcon size={84} />} title="We couldn’t find that"
        description="The link may be old or mistyped. Ticket links stop working after the order is picked up."
        action={<Button href="/" variant="secondary" size="md">Go to Laundry.ph</Button>} />
    </main>
  );
}
