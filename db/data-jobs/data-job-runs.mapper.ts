import { Timestamp } from "firebase-admin/firestore";
import type {
  DataJobKind,
  DataJobRun,
  DataJobRunStatus,
} from "@/lib/domain/data-jobs.types";
import { normalizeTimestamp } from "@/db/utils/timestamp.utils";

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
    throw new Error("Data job run jobKey must be a string.");
  }

  if (typeof run.jobName !== "string") {
    throw new Error("Data job run jobName must be a string.");
  }

  if (!DATA_JOB_KINDS.includes(run.kind)) {
    throw new Error("Data job run kind must be a valid DataJobKind.");
  }

  if (!DATA_JOB_RUN_STATUSES.includes(run.status)) {
    throw new Error("Data job run status must be a valid DataJobRunStatus.");
  }

  if (typeof run.dryRun !== "boolean") {
    throw new Error("Data job run dryRun must be a boolean.");
  }

  if (typeof run.triggeredByUserId !== "string") {
    throw new Error("Data job run triggeredByUserId must be a string.");
  }

  if (typeof run.triggeredByGithubUsername !== "string") {
    throw new Error("Data job run triggeredByGithubUsername must be a string.");
  }

  if (typeof run.summary !== "string") {
    throw new Error("Data job run summary must be a string.");
  }

  if (run.errorMessage !== null && typeof run.errorMessage !== "string") {
    throw new Error("Data job run errorMessage must be a string or null.");
  }

  if (!(run.startedAt instanceof Timestamp)) {
    throw new Error("Data job run startedAt must be a Timestamp.");
  }

  if (run.finishedAt !== null && !(run.finishedAt instanceof Timestamp)) {
    throw new Error("Data job run finishedAt must be a Timestamp or null.");
  }
}

/**
 * Normalizes a Firestore data-job run document into the app model.
 *
 * @param id The Firestore document id.
 * @param run The raw Firestore data-job run document.
 * @returns The normalized data-job run.
 */
export function normalizeDataJobRun(
  id: string,
  run: FirestoreDataJobRun,
): DataJobRun {
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
  assertFirestoreDataJobRun(run);
  return normalizeDataJobRun(id, run);
}

/**
 * Serializes a data-job run for Firestore storage.
 *
 * @param run The normalized data-job run without its document id.
 * @returns The Firestore-ready data-job run document.
 */
export function serializeDataJobRun(
  run: Omit<DataJobRun, "id">,
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
    startedAt: Timestamp.fromDate(run.startedAt),
    finishedAt: run.finishedAt ? Timestamp.fromDate(run.finishedAt) : null,
  };
}
