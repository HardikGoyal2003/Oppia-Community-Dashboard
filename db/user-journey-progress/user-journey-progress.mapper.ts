import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import type {
  DerivedProgressState,
  ManualProgressState,
  UserJourneyProgressModel,
} from "@/lib/domain/contributor-journey.types";
import { DERIVED_JOURNEY_KEYS } from "@/lib/domain/contributor-journey.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type FirestoreManualProgressState = {
  completed: boolean;
  completedAt: Timestamp | null;
};

type FirestoreDerivedProgressState = {
  completed: boolean;
  completedAt: Timestamp | null;
  sourceUrl: string | null;
};

export type FirestoreUserJourneyProgress = {
  createdAt: Timestamp;
  derivedState: Record<string, FirestoreDerivedProgressState>;
  manualProgress: Record<string, FirestoreManualProgressState>;
  platform: ContributionPlatform;
  updatedAt: Timestamp;
};

const CONTRIBUTION_PLATFORMS: ContributionPlatform[] = ["WEB", "ANDROID"];

/**
 * Validates one stored manual journey progress entry.
 *
 * @param itemId The stable manual journey item id.
 * @param value The Firestore value to validate.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertManualProgressState(
  itemId: string,
  value: FirebaseFirestore.DocumentData | null,
): asserts value is FirestoreManualProgressState {
  if (!value || typeof value !== "object") {
    throw new DbValidationError(
      `manualProgress.${itemId}`,
      "Journey manual progress entry must be an object.",
    );
  }

  if (!("completed" in value) || typeof value.completed !== "boolean") {
    throw new DbValidationError(
      `manualProgress.${itemId}.completed`,
      "Journey manual progress completed must be a boolean.",
    );
  }

  if (!("completedAt" in value)) {
    throw new DbValidationError(
      `manualProgress.${itemId}.completedAt`,
      "Journey manual progress completedAt is required.",
    );
  }

  const completedAt = value.completedAt as
    | Timestamp
    | null
    | string
    | number
    | boolean
    | object
    | undefined;
  if (completedAt !== null) {
    assertTimestamp(
      "Journey manual progress",
      `manualProgress.${itemId}.completedAt`,
      completedAt,
    );
  }
}

/**
 * Validates one stored derived journey progress entry.
 *
 * @param key The derived journey key being validated.
 * @param value The Firestore value to validate.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertDerivedProgressState(
  key: string,
  value: FirebaseFirestore.DocumentData | null,
): asserts value is FirestoreDerivedProgressState {
  if (!value || typeof value !== "object") {
    throw new DbValidationError(
      `derivedState.${key}`,
      "Journey derived progress entry must be an object.",
    );
  }

  if (!("completed" in value) || typeof value.completed !== "boolean") {
    throw new DbValidationError(
      `derivedState.${key}.completed`,
      "Journey derived progress completed must be a boolean.",
    );
  }

  if (!("completedAt" in value)) {
    throw new DbValidationError(
      `derivedState.${key}.completedAt`,
      "Journey derived progress completedAt is required.",
    );
  }

  const completedAt = value.completedAt as
    | Timestamp
    | null
    | string
    | number
    | boolean
    | object
    | undefined;
  if (completedAt !== null) {
    assertTimestamp(
      "Journey derived progress",
      `derivedState.${key}.completedAt`,
      completedAt,
    );
  }

  if (
    !("sourceUrl" in value) ||
    (value.sourceUrl !== null && typeof value.sourceUrl !== "string")
  ) {
    throw new DbValidationError(
      `derivedState.${key}.sourceUrl`,
      "Journey derived progress sourceUrl must be a string or null.",
    );
  }
}

/**
 * Validates the stored Firestore user journey progress document shape.
 *
 * @param progress The raw Firestore document data.
 * @returns Nothing. Throws when the document is invalid.
 */
function assertFirestoreUserJourneyProgress(
  progress: FirebaseFirestore.DocumentData,
): asserts progress is FirestoreUserJourneyProgress {
  if (!CONTRIBUTION_PLATFORMS.includes(progress.platform)) {
    throw new DbValidationError(
      "platform",
      "Journey progress platform must be WEB or ANDROID.",
    );
  }

  if (
    !progress.manualProgress ||
    typeof progress.manualProgress !== "object" ||
    Array.isArray(progress.manualProgress)
  ) {
    throw new DbValidationError(
      "manualProgress",
      "Journey manual progress must be an object.",
    );
  }

  for (const [itemId, value] of Object.entries(
    progress.manualProgress,
  ) as Array<[string, FirebaseFirestore.DocumentData | null]>) {
    assertManualProgressState(itemId, value);
  }

  if (
    !progress.derivedState ||
    typeof progress.derivedState !== "object" ||
    Array.isArray(progress.derivedState)
  ) {
    throw new DbValidationError(
      "derivedState",
      "Journey derived state must be an object.",
    );
  }

  for (const key of DERIVED_JOURNEY_KEYS) {
    if (!(key in progress.derivedState)) {
      throw new DbValidationError(
        `derivedState.${key}`,
        `Journey derived state ${key} is required.`,
      );
    }

    assertDerivedProgressState(key, progress.derivedState[key]);
  }

  assertTimestamp("Journey progress", "createdAt", progress.createdAt);
  assertTimestamp("Journey progress", "updatedAt", progress.updatedAt);
}

/**
 * Normalizes a stored manual journey progress entry into the app model.
 *
 * @param state The stored Firestore manual progress state.
 * @returns The normalized manual progress state.
 */
function normalizeManualProgressState(
  state: FirestoreManualProgressState,
): ManualProgressState {
  return {
    completed: state.completed,
    completedAt: state.completedAt
      ? normalizeTimestamp(state.completedAt)
      : null,
  };
}

/**
 * Normalizes a stored derived journey progress entry into the app model.
 *
 * @param state The stored Firestore derived progress state.
 * @returns The normalized derived progress state.
 */
function normalizeDerivedProgressState(
  state: FirestoreDerivedProgressState,
): DerivedProgressState {
  return {
    completed: state.completed,
    completedAt: state.completedAt
      ? normalizeTimestamp(state.completedAt)
      : null,
    sourceUrl: state.sourceUrl,
  };
}

/**
 * Converts a stored Firestore user journey progress document to the app model.
 *
 * @param progress The raw Firestore document data.
 * @returns The normalized user journey progress model.
 */
export function normalizeUserJourneyProgressDocument(
  progress: FirebaseFirestore.DocumentData,
): UserJourneyProgressModel {
  assertFirestoreUserJourneyProgress(progress);

  return {
    createdAt: normalizeTimestamp(progress.createdAt),
    derivedState: Object.fromEntries(
      DERIVED_JOURNEY_KEYS.map((key) => [
        key,
        normalizeDerivedProgressState(progress.derivedState[key]),
      ]),
    ) as UserJourneyProgressModel["derivedState"],
    manualProgress: Object.fromEntries(
      Object.entries(progress.manualProgress).map(([itemId, state]) => [
        itemId,
        normalizeManualProgressState(state),
      ]),
    ),
    platform: progress.platform,
    updatedAt: normalizeTimestamp(progress.updatedAt),
  };
}

/**
 * Serializes one manual journey progress entry to Firestore shape.
 *
 * @param state The normalized manual progress state.
 * @returns The Firestore-ready manual progress entry.
 */
function serializeManualProgressState(
  state: ManualProgressState,
): FirestoreManualProgressState {
  return {
    completed: state.completed,
    completedAt: state.completedAt
      ? Timestamp.fromDate(state.completedAt)
      : null,
  };
}

/**
 * Serializes one derived journey progress entry to Firestore shape.
 *
 * @param state The normalized derived progress state.
 * @returns The Firestore-ready derived progress entry.
 */
export function serializeDerivedProgressState(
  state: DerivedProgressState,
): FirestoreDerivedProgressState {
  return {
    completed: state.completed,
    completedAt: state.completedAt
      ? Timestamp.fromDate(state.completedAt)
      : null,
    sourceUrl: state.sourceUrl,
  };
}

/**
 * Serializes the normalized user journey progress model for Firestore writes.
 *
 * @param progress The normalized user journey progress model.
 * @returns The Firestore-ready journey progress document.
 */
export function serializeUserJourneyProgress(
  progress: UserJourneyProgressModel,
): FirestoreUserJourneyProgress {
  return {
    createdAt: Timestamp.fromDate(progress.createdAt),
    derivedState: Object.fromEntries(
      DERIVED_JOURNEY_KEYS.map((key) => [
        key,
        serializeDerivedProgressState(progress.derivedState[key]),
      ]),
    ),
    manualProgress: Object.fromEntries(
      Object.entries(progress.manualProgress).map(([itemId, state]) => [
        itemId,
        serializeManualProgressState(state),
      ]),
    ),
    platform: progress.platform,
    updatedAt: Timestamp.fromDate(progress.updatedAt),
  };
}
