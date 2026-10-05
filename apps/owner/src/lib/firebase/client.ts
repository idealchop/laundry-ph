import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseWebConfig, firestoreDatabaseId, hasFirebaseWebConfig } from "./config";

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

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
  return db;
}

export function getFirebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(getFirebaseApp());
  auth.languageCode = "en";
  return auth;
}
