import {
  readBooleanEnv,
  readEnv,
  readEnvWithDefault,
  readNumberEnv,
} from "@/lib/config/env";

type FirebaseRuntimeConfig = {
  useFirestoreEmulator: boolean;
  firestoreEmulatorHost: string;
  firestoreEmulatorPort: number;
};

/**
 * Returns the shared Firebase runtime configuration used by both admin and client initializers.
 *
 * @returns The Firebase runtime configuration derived from environment variables.
 */
export function getFirebaseRuntimeConfig(): FirebaseRuntimeConfig {
  return {
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
 * Returns the Firebase project id for server-side admin initialization.
 *
 * @returns The server-side Firebase project id.
 */
export function getFirebaseAdminProjectId(): string {
  return readEnvWithDefault(
    "FIREBASE_PROJECT_ID",
    readEnvWithDefault(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "demo-oppia-community-dashboard",
    ),
  );
}
