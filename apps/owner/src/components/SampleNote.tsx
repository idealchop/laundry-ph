import { SampleDataTag } from "@river-apps/ui";
import { data } from "@/data";

/** Renders the kit SampleDataTag only while the app runs on sample fixtures. */
export function SampleNote({ className }: { className?: string }) {
  return data.isSample ? <SampleDataTag className={className} /> : null;
}
