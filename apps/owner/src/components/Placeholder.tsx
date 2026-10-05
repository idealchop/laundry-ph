import { Check } from "lucide-react";
import { Icon3D, type IconName } from "@river-apps/icons";
import { Button, Card, EmptyState, Topbar } from "@river-apps/ui";
import { SampleNote } from "./SampleNote";

export interface PlaceholderProps {
  title: string;
  description: string;
  icon: IconName;
  /** What this module will do (from the Laundry.ph feature map). */
  planned: string[];
  phase: string;
  backHref?: string;
}

/** Stand-in page for modules that are not built yet, so navigation works end to end. */
export function Placeholder({ title, description, icon, planned, phase, backHref = "/home" }: PlaceholderProps) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 pt-4 lg:max-w-[880px] lg:px-[30px] lg:pt-6">
      <Topbar className="px-1" title={title} subtitle={<>{description} <SampleNote className="ml-1 align-middle" /></>} />
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <EmptyState
          illustration={<Icon3D name={icon} size={84} />}
          title="Coming soon"
          description={`This screen is planned for ${phase}. The navigation already works, so you can click around the rest of the app.`}
          action={<Button href={backHref} variant="secondary" size="md">Back to home</Button>}
        />
        <Card className="px-5 py-4">
          <b className="text-[16px]">What it will do</b>
          <ul className="mt-2.5 flex flex-col gap-2">
            {planned.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-[14px] font-medium text-ink-2">
                <span className="mt-0.5 flex size-5 flex-none items-center justify-center rounded-full bg-grey-100"><Check size={12} strokeWidth={3} /></span>
                {p}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
