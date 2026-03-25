import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  requireEnv,
} from "@/lib/config/env";

export function initFirebaseAdmin() {
  const useFirestoreEmulator =
    readBooleanEnv("FIREBASE_EMULATOR_ENABLED") ||
    Boolean(readEnv("FIRESTORE_EMULATOR_HOST"));

  const projectId = readEnvWithDefault(
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "demo-oppia-leads-dashboard",
  );

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

export function getAdminFirestore() {
  initFirebaseAdmin();
  return getFirestore();
}
