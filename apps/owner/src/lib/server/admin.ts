/**
 * firebase-admin for Route Handlers (Node runtime only). On App Hosting the backend's
 * compute service account supplies credentials (Application Default Credentials).
 * Locally, FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST point it at emulators.
 * Never import this from client components.
 */
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let app: App | null = null;
let db: Firestore | null = null;

function projectId(): string {
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mylaundryph";
}

export function adminApp(): App {
  if (app) return app;
  app = getApps()[0] ?? initializeApp({ projectId: projectId() });
  return app;
}

/** The named Laundry.ph database for this backend (laundrydb-dev on laundry-dev, laundrydb on prod). */
export function databaseId(): string {
  return process.env.NEXT_PUBLIC_FIRESTORE_DATABASE || "laundrydb-dev";
}

export function adminDb(): Firestore {
  if (db) return db;
  db = getFirestore(adminApp(), databaseId());
  return db;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

/** dev / local builds only (dev tools, sample shops in listings). */
export function isDevEnv(): boolean {
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? "local";
  return env === "dev" || env === "local";
}
