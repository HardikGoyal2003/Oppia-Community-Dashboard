import { Timestamp } from "firebase-admin/firestore";
import type {
  DataJobKind,
  DataJobRun,
  DataJobRunStatus,
} from "@/lib/domain/data-jobs.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertOptionalTimestamp,
  assertTimestamp,
  normalizeTimestamp,
  toFirestoreTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

const DATA_JOB_KINDS: DataJobKind[] = [
  "AUDIT",
  "BACKFILL",
  "MIGRATION",
  "CLEANUP",
];

const DATA_JOB_RUN_STATUSES: DataJobRunStatus[] = [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
];

export type FirestoreDataJobRun = Omit<
  DataJobRun,
  "id" | "startedAt" | "finishedAt"
> & {
  startedAt: Timestamp;
  finishedAt: Timestamp | null;
};

/** Summary recorded when a data-job run fails or is interrupted. */
export const FAILED_DATA_JOB_SUMMARY = "Job failed.";

/** Error recorded on runs that were interrupted before finishing. */
export const STALE_DATA_JOB_RUN_ERROR_MESSAGE =
  "Run timed out or was interrupted before it could finish. Re-run the job to continue.";

/**
 * Validates the raw Firestore data-job run document shape.
 *
 * @param run The raw Firestore data-job run document data.
 * @returns Nothing. Throws when the data-job run shape is invalid.
 */
function assertFirestoreDataJobRun(
  run: FirebaseFirestore.DocumentData,
): asserts run is FirestoreDataJobRun {
  if (typeof run.jobKey !== "string") {
    throw new DbValidationError(
      "jobKey",
      "Data job run jobKey must be a string.",
    );
  }

  if (typeof run.jobName !== "string") {
    throw new DbValidationError(
      "jobName",
      "Data job run jobName must be a string.",
    );
  }

  if (!DATA_JOB_KINDS.includes(run.kind)) {
    throw new DbValidationError(
      "kind",
      "Data job run kind must be a valid DataJobKind.",
    );
  }

  if (!DATA_JOB_RUN_STATUSES.includes(run.status)) {
    throw new DbValidationError(
      "status",
      "Data job run status must be a valid DataJobRunStatus.",
    );
  }

  if (typeof run.dryRun !== "boolean") {
    throw new DbValidationError(
      "dryRun",
      "Data job run dryRun must be a boolean.",
    );
  }

  if (typeof run.triggeredByUserId !== "string") {
    throw new DbValidationError(
      "triggeredByUserId",
      "Data job run triggeredByUserId must be a string.",
    );
  }

  if (typeof run.triggeredByGithubUsername !== "string") {
    throw new DbValidationError(
      "triggeredByGithubUsername",
      "Data job run triggeredByGithubUsername must be a string.",
    );
  }

  if (typeof run.summary !== "string") {
    throw new DbValidationError(
      "summary",
      "Data job run summary must be a string.",
    );
  }

  if (run.errorMessage !== null && typeof run.errorMessage !== "string") {
    throw new DbValidationError(
      "errorMessage",
      "Data job run errorMessage must be a string or null.",
    );
  }

  assertTimestamp("Data job run", "startedAt", run.startedAt);
  assertOptionalTimestamp("Data job run", "finishedAt", run.finishedAt);
}

/**
 * Normalizes a Firestore data-job run document into the app model.
 *
 * @param id The Firestore document id.
 * @param run The raw Firestore data-job run document.
 * @returns The normalized data-job run.
 */
function normalizeDataJobRun(id: string, run: FirestoreDataJobRun): DataJobRun {
  return {
    id,
    jobKey: run.jobKey,
    jobName: run.jobName,
    kind: run.kind,
    status: run.status,
    dryRun: run.dryRun,
    triggeredByUserId: run.triggeredByUserId,
    triggeredByGithubUsername: run.triggeredByGithubUsername,
    summary: run.summary,
    errorMessage: run.errorMessage,
    startedAt: normalizeTimestamp(run.startedAt),
    finishedAt: run.finishedAt ? normalizeTimestamp(run.finishedAt) : null,
    schemaVersion: run.schemaVersion,
  };
}

/**
 * Normalizes raw Firestore data-job run document data into the app model.
 *
 * @param id The Firestore document id.
 * @param run The raw Firestore data-job run document data.
 * @returns The normalized data-job run.
 */
export function normalizeDataJobRunDocument(
  id: string,
  run: FirebaseFirestore.DocumentData,
): DataJobRun {
  const migratedRun = migrateDocument(SCHEMA_KEYS.DATA_JOB_RUNS, run);
  assertFirestoreDataJobRun(migratedRun);
  return normalizeDataJobRun(id, migratedRun);
}

/**
 * Serializes a data-job run for Firestore storage.
 *
 * @param run The normalized data-job run without its document id.
 * @returns The Firestore-ready data-job run document.
 */
export function serializeDataJobRun(
  run: Omit<DataJobRun, "id" | "schemaVersion">,
): FirestoreDataJobRun {
  return {
    jobKey: run.jobKey,
    jobName: run.jobName,
    kind: run.kind,
    status: run.status,
    dryRun: run.dryRun,
    triggeredByUserId: run.triggeredByUserId,
    triggeredByGithubUsername: run.triggeredByGithubUsername,
    summary: run.summary,
    errorMessage: run.errorMessage,
    startedAt: toFirestoreTimestamp(run.startedAt),
    finishedAt: run.finishedAt ? toFirestoreTimestamp(run.finishedAt) : null,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.DATA_JOB_RUNS),
  };
}

/**
 * Builds the Firestore update payload for marking a run as succeeded.
 *
 * @param summary The completion summary to persist.
 * @returns The Firestore-ready success update.
 */
export function serializeDataJobRunSuccessUpdate(summary: string): Pick<
  FirestoreDataJobRun,
  "status" | "summary" | "errorMessage"
> & {
  finishedAt: Timestamp;
} {
  return {
    status: "SUCCEEDED",
    summary,
    errorMessage: null,
    finishedAt: Timestamp.now(),
  };
}

/**
 * Builds the Firestore update payload for marking a run as failed.
 *
 * @param errorMessage The failure message to persist.
 * @returns The Firestore-ready failure update.
 */
export function serializeDataJobRunFailureUpdate(errorMessage: string): Pick<
  FirestoreDataJobRun,
  "status" | "summary" | "errorMessage"
> & {
  finishedAt: Timestamp;
} {
  return {
    status: "FAILED",
    summary: FAILED_DATA_JOB_SUMMARY,
    errorMessage,
    finishedAt: Timestamp.now(),
  };
}

/**
 * Builds the Firestore update payload for marking a stale running run as failed.
 *
 * @param finishedAt The time the stale run is treated as finished.
 * @returns The Firestore-ready stale-failure update.
 */
export function serializeStaleDataJobRunFailureUpdate(finishedAt: Date): Pick<
  FirestoreDataJobRun,
  "status" | "summary" | "errorMessage"
> & {
  finishedAt: Timestamp;
} {
  return {
    status: "FAILED",
    summary: FAILED_DATA_JOB_SUMMARY,
    errorMessage: STALE_DATA_JOB_RUN_ERROR_MESSAGE,
    finishedAt: toFirestoreTimestamp(finishedAt),
  };
}

/**
 * Applies stale-run failure fields to a normalized in-memory data-job run.
 *
 * @param run The normalized data-job run.
 * @param finishedAt The time the stale run is treated as finished.
 * @returns A failed run reflecting stale interruption.
 */
export function normalizeStaleDataJobRun(
  run: DataJobRun,
  finishedAt: Date,
): DataJobRun {
  return {
    ...run,
    status: "FAILED",
    summary: FAILED_DATA_JOB_SUMMARY,
    errorMessage: STALE_DATA_JOB_RUN_ERROR_MESSAGE,
    finishedAt,
  };
}
