import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  assertOptionalTimestamp,
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import type {
  DerivedJourneyKey,
  DerivedProgressState,
  ManualProgressState,
  UserJourneyProgressModel,
} from "@/lib/domain/contributor-journey.types";
import { DERIVED_JOURNEY_KEYS } from "@/lib/domain/contributor-journey.types";
import { isContributionPlatform } from "@/lib/auth/auth.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

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
  schemaVersion: number;
};

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

  assertOptionalTimestamp(
    "Journey manual progress",
    `manualProgress.${itemId}.completedAt`,
    value.completedAt,
  );
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

  assertOptionalTimestamp(
    "Journey derived progress",
    `derivedState.${key}.completedAt`,
    value.completedAt,
  );

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
  if (!isContributionPlatform(progress.platform)) {
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
    progress.manualProgress as Record<
      string,
      FirebaseFirestore.DocumentData | null
    >,
  )) {
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
  const migratedProgress = migrateDocument(
    SCHEMA_KEYS.USER_JOURNEY_PROGRESS,
    progress,
  );
  assertFirestoreUserJourneyProgress(migratedProgress);

  const derivedState: UserJourneyProgressModel["derivedState"] = {
    FIRST_ISSUE_CLAIMED: normalizeDerivedProgressState(
      migratedProgress.derivedState.FIRST_ISSUE_CLAIMED,
    ),
    FIRST_PR_MERGED: normalizeDerivedProgressState(
      migratedProgress.derivedState.FIRST_PR_MERGED,
    ),
    SECOND_PR_MERGED: normalizeDerivedProgressState(
      migratedProgress.derivedState.SECOND_PR_MERGED,
    ),
  };

  return {
    createdAt: normalizeTimestamp(migratedProgress.createdAt),
    derivedState,
    manualProgress: Object.fromEntries(
      Object.entries(migratedProgress.manualProgress).map(([itemId, state]) => [
        itemId,
        normalizeManualProgressState(state),
      ]),
    ),
    platform: migratedProgress.platform,
    updatedAt: normalizeTimestamp(migratedProgress.updatedAt),
    schemaVersion: migratedProgress.schemaVersion,
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
  progress: Omit<UserJourneyProgressModel, "schemaVersion">,
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
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.USER_JOURNEY_PROGRESS),
  };
}

/**
 * Builds the Firestore update payload for one derived journey state entry.
 *
 * @param key The derived journey key to update.
 * @param state The derived progress state to persist.
 * @param updatedAt The document update timestamp to persist.
 * @returns The Firestore-ready partial update document.
 */
export function serializeDerivedJourneyStateUpdate(
  key: DerivedJourneyKey,
  state: DerivedProgressState,
  updatedAt: Date,
): Record<string, FirestoreDerivedProgressState | Timestamp> {
  return {
    [`derivedState.${key}`]: serializeDerivedProgressState(state),
    updatedAt: Timestamp.fromDate(updatedAt),
  };
}
