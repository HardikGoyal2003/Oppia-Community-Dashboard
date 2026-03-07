import { getApp, getApps, initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";

declare global {
  var __firestoreEmulatorConnected: boolean | undefined;
}

const useFirestoreEmulator =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);
const db = getFirestore(app);

const firestoreEmulatorHost =
  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "127.0.0.1";

const firestoreEmulatorPort = Number(
  process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || "8080"
);

if (
  useFirestoreEmulator &&
  !globalThis.__firestoreEmulatorConnected
) {
  connectFirestoreEmulator(
    db,
    firestoreEmulatorHost,
    firestoreEmulatorPort
  );
  globalThis.__firestoreEmulatorConnected = true;
}

export { db };
