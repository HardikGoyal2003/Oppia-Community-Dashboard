import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export function initFirebaseAdmin() {
  const useFirestoreEmulator =
    process.env.FIREBASE_EMULATOR_ENABLED === "true" ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-oppia-leads-dashboard";

  if (!getApps().length) {
    if (useFirestoreEmulator) {
      initializeApp({ projectId });
      return;
    }

    initializeApp({
      credential: cert({
        projectId,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
}

export function getAdminFirestore() {
  initFirebaseAdmin();
  return getFirestore();
}
