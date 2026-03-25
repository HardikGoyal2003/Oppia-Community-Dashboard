import {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  readNumberEnv,
  requireEnv,
} from "@/lib/config/env";

export type FirebaseRuntimeConfig = {
  projectId: string;
  useFirestoreEmulator: boolean;
  firestoreEmulatorHost: string;
  firestoreEmulatorPort: number;
};

export type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

/**
 * Returns the shared Firebase runtime configuration used by both admin and client initializers.
 *
 * @returns The Firebase runtime configuration derived from environment variables.
 */
export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  return {
    projectId: readEnvWithDefault(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "demo-oppia-leads-dashboard",
    ),
    useFirestoreEmulator:
      readBooleanEnv("FIREBASE_EMULATOR_ENABLED") ||
      readBooleanEnv("NEXT_PUBLIC_USE_FIREBASE_EMULATOR") ||
      Boolean(readEnv("FIRESTORE_EMULATOR_HOST")) ||
      Boolean(readEnv("NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST")),
    firestoreEmulatorHost: readEnvWithDefault(
      "NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST",
      readEnvWithDefault("FIRESTORE_EMULATOR_HOST", "127.0.0.1"),
    ),
    firestoreEmulatorPort: readNumberEnv(
      "NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT",
      readNumberEnv("FIRESTORE_EMULATOR_PORT", 8080),
    ),
  };
}

/**
 * Returns the required Firebase client SDK configuration.
 *
 * @returns The validated Firebase client configuration.
 */
export function getFirebaseClientConfig(): FirebaseClientConfig {
  return {
    apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requireEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requireEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}
