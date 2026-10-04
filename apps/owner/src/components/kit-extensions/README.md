# kit-extensions

Small components Laundry.ph needs that the River Apps UI Kit (`@river-apps/ui` @ `40c7221`) does not have yet.
They use only kit components, tokens and Tailwind classes, so they can be upstreamed to `packages/ui/src/components/` as-is.

| Component | Why | Upstream plan |
| --- | --- | --- |
| `Chip` | Toggle pills (detergent, add-ons). Kit `SegmentedControl` buttons are under 44px. | New `Chip` in ui; built on `Button` secondary + pill |
| `ChoiceTile` | One-of-many cards (service, payment method), stacked or inline | New `ChoiceTile` in ui |
| `StepTracker` | Order stages Received → Washing → Drying → Folding → Ready | New `StepTracker` in ui (data display) |
| `WideSidebar` | Kit `Sidebar` is a fixed 244px, which truncates "Message Automations" + badge | Add `size?: "default" \| "wide"` to `Sidebar` |
| `FieldLabel` | Label + right-aligned note above custom controls | Export `FieldShell`-style label from ui |

Rules kept: monochrome containers (selection = 2px black ring + check, never colour), ≥44px tap targets, words alongside every status.
