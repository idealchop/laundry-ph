/**
 * Firebase web config for Laundry.ph (project mylaundryph).
 *
 * On App Hosting, FIREBASE_WEBAPP_CONFIG is injected at build time and mapped in
 * next.config.ts. Locally, copy apps/owner/.env.example → .env.local.
 *
 * Named Firestore databases (NOT riverdb):
 *   laundrydb       production
 *   laundrydb-dev   development / seed sample data
 */
export const firebaseWebConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "mylaundryph.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "mylaundryph",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "mylaundryph.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "500578192242",
};

/** Named Firestore database id. Default: laundrydb-dev for local/dev. */
export const firestoreDatabaseId =
  process.env.NEXT_PUBLIC_FIRESTORE_DATABASE ?? "laundrydb-dev";

/** Active shop document id under shops/{shopId}. */
export const shopId = process.env.NEXT_PUBLIC_SHOP_ID ?? "sample-laundry";

export function hasFirebaseWebConfig(): boolean {
  return Boolean(firebaseWebConfig.apiKey && firebaseWebConfig.appId && firebaseWebConfig.projectId);
}
