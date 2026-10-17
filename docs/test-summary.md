# Test summary

Matrix per river-ai-rules 03-test: HP (happy path), NEG (negative), ODD (edge), NF (non-functional). Process: Create → Apply → Execute, with a log below.

## Automated (Vitest, `pnpm test`, runs in CI)
| ID | Area | Type | Result (2026-10-15) |
| --- | --- | --- | --- |
| TC-PLAN-HP-01 | Partner 10 walk-ins/day, Pro unlimited | HP | Pass |
| TC-PLAN-HP-02 | `ALL_FEATURES_UNLOCKED` unlocks Pro for all | HP | Pass |
| TC-PLAN-NEG-01 | Partner has no Pro features | NEG | Pass |
| TC-PLAN-ODD-01 | Partner may open walk-in POS only | ODD | Pass |
| TC-ORD-HP-01 | Walk-in flow received → washing, ready → claimed | HP | Pass |
| TC-ORD-HP-02 | River Mobile finishes as delivered | HP | Pass |
| TC-ORD-NEG-01 | Finished order has no next step | NEG | Pass |
| TC-ORD-ODD-01 | Manila day rolls over at 16:00 UTC | ODD | Pass |
| TC-QR-HP-01 | QR booking with PH mobile | HP | Pass |
| TC-QR-HP-02 | QR booking with email | HP | Pass |
| TC-QR-NEG-01 | Bad contact rejected | NEG | Pass |
| TC-QR-NEG-02 | Past slot rejected | NEG | Pass |
| TC-QR-ODD-01 | Pickup without address rejected | ODD | Pass |
| TC-QR-ODD-02 | Mobile formats normalise to +63 | ODD | Pass |

## Dev smoke (Playwright, laundry-dev, commit 453f353)
| ID | Check | Type | Result |
| --- | --- | --- | --- |
| SMK-01 | Home loads at 320px and 1280px, no horizontal overflow, no page errors, `noindex` | HP/NF | Pass |
| SMK-02 | `/terms`, `/privacy` load at 320/1280, `robots=index, follow` | HP/NF | Pass |
| SMK-03 | `/l/{unknown token}` shows "This link is not active" at 320/1280 | NEG | Pass |
| SMK-04 | GET `/api/staff/{unknown}` → 404 `not_found` | NEG | Pass |
| SMK-05 | POST walk-in without quantity → 400 `invalid_request` | NEG | Pass |
| SMK-06 | POST `/api/public/bookings` bad contact → 400 `invalid_request` | NEG | Pass |
| SMK-07 | GET `/api/public/bookings/{unknown}` → 404 `not_found` | NEG | Pass |
| SMK-08 | Staff link happy path (publish → queue → walk-in → advance) | HP | Passed on ccd65a8 (2026-10-14); not re-run on 453f353 because the QA account password is no longer on the box |

## Not yet covered
- Playwright BDD feature files (`.feature`) for owner flows.
- Firestore rules tests beyond `pnpm test:emulator`.

## Execution log
| Date (UTC+8) | Commit | Run | Result |
| --- | --- | --- | --- |
| 2026-10-15 15:53 | 453f353 | `pnpm test` (14 tests) | 14/14 pass |
| 2026-10-15 ~16:05 | 453f353 | Dev smoke SMK-01…07 | all pass |
