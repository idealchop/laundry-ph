import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, type Firestore } from "firebase/firestore";
import { firebaseWebConfig, firestoreDatabaseId, hasFirebaseWebConfig } from "./config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/** Local emulators (firebase emulators:start --only auth,firestore). Never on App Hosting. */
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
const emulatorHost = process.env.NEXT_PUBLIC_EMULATOR_HOST ?? "127.0.0.1";
const firestoreEmulatorPort = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT ?? 8080);
const authEmulatorPort = Number(process.env.NEXT_PUBLIC_AUTH_EMULATOR_PORT ?? 9099);

export function getFirebaseApp(): FirebaseApp {
  if (!hasFirebaseWebConfig()) {
    throw new Error(
      "Firebase web config missing. Set NEXT_PUBLIC_FIREBASE_API_KEY / APP_ID (see apps/owner/.env.example).",
    );
  }
  if (app) return app;
  app = getApps().length ? getApp() : initializeApp(firebaseWebConfig);
  return app;
}

/** Named database: laundrydb or laundrydb-dev (never the default "(default)" / riverdb). */
export function getDb(): Firestore {
  if (db) return db;
  db = getFirestore(getFirebaseApp(), firestoreDatabaseId);
  if (useEmulators) connectFirestoreEmulator(db, emulatorHost, firestoreEmulatorPort);
  return db;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  auth.languageCode = "en";
  if (useEmulators) connectAuthEmulator(auth, `http://${emulatorHost}:${authEmulatorPort}`, { disableWarnings: true });
  // Dev / test phone numbers: skip reCAPTCHA hang in headless and App Hosting preview.
  if (process.env.NEXT_PUBLIC_APP_ENV === "dev" || process.env.NEXT_PUBLIC_APP_ENV === "local") {
    auth.settings.appVerificationDisabledForTesting = true;
  }
  return auth;
}
