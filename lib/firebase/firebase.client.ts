import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  getFirebaseClientConfig,
  getFirebaseRuntimeConfig,
} from "./firebase.config";

declare global {
  var __firestoreEmulatorConnected: boolean | undefined;
}

const firebaseRuntimeConfig = getFirebaseRuntimeConfig();
const firebaseConfig = getFirebaseClientConfig();

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

if (
  firebaseRuntimeConfig.useFirestoreEmulator &&
  !globalThis.__firestoreEmulatorConnected
) {
  connectFirestoreEmulator(
    db,
    firebaseRuntimeConfig.firestoreEmulatorHost,
    firebaseRuntimeConfig.firestoreEmulatorPort,
  );
  globalThis.__firestoreEmulatorConnected = true;
}

export { db };
