# Auth flow

Laundry.ph uses Firebase Auth in project `mylaundryph`. **Do not change Auth settings from code or the CLI**; the console is the only place, and only with the owner's OK.

## Sign-in methods (client: `lib/auth.tsx`, `components/auth/AuthGateSheet.tsx`)
| Method | Flow |
| --- | --- |
| Google | `signInWithPopup`; falls back to `signInWithRedirect` when popups are blocked |
| Phone (PH mobile) | `signInWithPhoneNumber` with invisible reCAPTCHA, then the SMS code |
| Guest browse | No Firebase user. A local flag (`laundry-ph-guest-v1`) lets a visitor look around; any write opens the sign-in sheet (AuthGate) |

## After sign-in
1. The owner app reads `shops/{shopId}/members/{uid}`. Firestore rules allow shop data only to active members (`isMember`) and owner-only actions to `role == 'owner'` (`isOwner`).
2. New users create their shop through the onboarding flow; the first member doc gets `role: owner`.

## Routes that don't use a Firebase session
| Route | Credential |
| --- | --- |
| `/api/staff/{token}/*` | Unguessable staff-link token published by the owner in `staff_links/{token}`; expires, scoped to one shop + branch |
| `/api/public/bookings*` | None (customer QR booking); rate-limited by IP, booking id is unguessable |
| `/api/v1/*` (Partner API) | `X-River-Key` header, SHA-256 compared in constant time |
| `/api/dev/test-booking` | `Authorization: Bearer <Firebase ID token>`, verified with Admin SDK |
| `/api/billing/webhook` | `Paymongo-Signature` HMAC |

## Sign-out
`signOut()` clears the Firebase session; the guest flag is cleared too.
