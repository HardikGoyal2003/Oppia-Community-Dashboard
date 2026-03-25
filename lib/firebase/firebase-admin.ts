import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { requireEnv } from "@/lib/config/env";
import { getFirebaseRuntimeConfig } from "./firebase.config";

/**
 * Initializes the Firebase Admin SDK using either emulator or production credentials.
 *
 * @returns Nothing. Ensures the admin app is initialized once per process.
 */
export function initFirebaseAdmin() {
  const { projectId, useFirestoreEmulator } = getFirebaseRuntimeConfig();

  if (!getApps().length) {
    if (useFirestoreEmulator) {
      initializeApp({ projectId });
      return;
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail: requireEnv("FIREBASE_CLIENT_EMAIL"),
        privateKey: requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n"),
      }),
    });
  }
}

/**
 * Returns the shared admin Firestore instance for server-side DB access.
 *
 * @returns The initialized admin Firestore instance.
 */
export function getAdminFirestore() {
  initFirebaseAdmin();
  return getFirestore();
}
