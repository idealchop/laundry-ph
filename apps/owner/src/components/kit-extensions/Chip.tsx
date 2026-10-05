import { Check } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button, cn } from "@river-apps/ui";

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Selected chips get the kit's focus treatment (white + 2px black ring) and a check. */
  selected?: boolean;
  /** Optional colourful 3D icon shown when not selected. */
  icon?: ReactNode;
  children: ReactNode;
}

/**
 * Toggleable pill for multi- or single-select options (detergent, add-ons).
 * Built on the kit `Button` (secondary, pill); 44px tall so it meets the tap-target rule.
 * Stays monochrome: selection is a black ring + check, never a colour fill.
 * Candidate for upstreaming to @river-apps/ui.
 */
export function Chip({ selected = false, icon, children, className, ...rest }: ChipProps) {
  return (
    <Button
      variant="secondary"
      size="md"
      pill
      aria-pressed={selected}
      className={cn("h-11 gap-1.5 px-3.5 text-[13.5px]", selected && "ring-2 ring-ink", !selected && icon ? "pl-2" : undefined, className)}
      leadingIcon={selected ? <Check size={16} strokeWidth={2.4} aria-hidden /> : icon}
      {...rest}
    >
      {children}
    </Button>
  );
}
