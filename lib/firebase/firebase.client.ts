import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  readBooleanEnv,
  readEnvWithDefault,
  readNumberEnv,
  requireEnv,
} from "@/lib/config/env";

declare global {
  var __firestoreEmulatorConnected: boolean | undefined;
}

const useFirestoreEmulator = readBooleanEnv(
  "NEXT_PUBLIC_USE_FIREBASE_EMULATOR",
);

const firebaseConfig = {
  apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
  authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
  appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

const firestoreEmulatorHost = readEnvWithDefault(
  "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST",
  "127.0.0.1",
);

const firestoreEmulatorPort = readNumberEnv(
  "NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT",
  8080,
);

if (useFirestoreEmulator && !globalThis.__firestoreEmulatorConnected) {
  connectFirestoreEmulator(db, firestoreEmulatorHost, firestoreEmulatorPort);
  globalThis.__firestoreEmulatorConnected = true;
}

export { db };
