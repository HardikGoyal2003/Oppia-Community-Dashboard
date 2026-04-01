import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { DataJobRun } from "@/lib/domain/data-jobs.types";
import { DB_PATHS } from "@/db/db-paths";
import { DbNotFoundError } from "@/db/db.errors";
import {
  type FirestoreDataJobRun,
  normalizeDataJobRunDocument,
  serializeDataJobRun,
} from "./data-job-runs.mapper";

const db = getAdminFirestore();
const dataJobRunsCollection = db.collection(
  DB_PATHS.DATA_JOB_RUNS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreDataJobRun>;

/**
 * Persists a new data-job run record.
 *
 * @param run The data-job run payload to store.
 * @returns The created run id.
 */
export async function createDataJobRun(
  run: Omit<DataJobRun, "id">,
): Promise<string> {
  const runRef = dataJobRunsCollection.doc();

  await runRef.set(serializeDataJobRun(run));

  return runRef.id;
}

/**
 * Retrieves a data-job run by document id.
 *
 * @param runId The data-job run document id.
 * @returns The normalized data-job run.
 */
export async function getDataJobRunById(runId: string): Promise<DataJobRun> {
  const snapshot = await dataJobRunsCollection.doc(runId).get();

  if (!snapshot.exists) {
    throw new DbNotFoundError("Data job run");
  }

  return normalizeDataJobRunDocument(snapshot.id, snapshot.data()!);
}

/**
 * Lists recent data-job runs sorted by start time descending.
 *
 * @param limit The maximum number of runs to return.
 * @returns The normalized data-job runs.
 */
export async function listDataJobRuns(limit = 20): Promise<DataJobRun[]> {
  const snapshot = await dataJobRunsCollection
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeDataJobRunDocument(doc.id, doc.data()),
  );
}

/**
 * Marks a data-job run as succeeded and records the completion summary.
 *
 * @param runId The data-job run document id.
 * @param summary The completion summary to persist.
 * @returns A promise that resolves when the run has been updated.
 */
export async function markDataJobRunSucceeded(
  runId: string,
  summary: string,
): Promise<void> {
  const runRef = dataJobRunsCollection.doc(runId);
  const snapshot = await runRef.get();

  if (!snapshot.exists) {
    throw new DbNotFoundError("Data job run");
  }

  await runRef.update({
    status: "SUCCEEDED",
    summary,
    errorMessage: null,
    finishedAt: new Date(),
  });
}

/**
 * Marks a data-job run as failed and records the failure message.
 *
 * @param runId The data-job run document id.
 * @param errorMessage The failure message to persist.
 * @returns A promise that resolves when the run has been updated.
 */
export async function markDataJobRunFailed(
  runId: string,
  errorMessage: string,
): Promise<void> {
  const runRef = dataJobRunsCollection.doc(runId);
  const snapshot = await runRef.get();

  if (!snapshot.exists) {
    throw new DbNotFoundError("Data job run");
  }

  await runRef.update({
    status: "FAILED",
    summary: "Job failed.",
    errorMessage,
    finishedAt: new Date(),
  });
}
