import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { DataJobRun } from "@/lib/domain/data-jobs.types";
import { DB_PATHS } from "@/db/db-paths";
import { getRequiredDocumentSnapshot } from "@/db/utils/document.utils";
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
 * How long a run may stay in `RUNNING` before it is treated as interrupted.
 * Data-job handlers have a 300s serverless limit, so anything older than this
 * was killed by the platform before it could update its own record.
 */
const STALE_RUN_THRESHOLD_MS = 6 * 60 * 1000;

/** Error recorded on runs that were interrupted before finishing. */
const STALE_RUN_ERROR_MESSAGE =
  "Run timed out or was interrupted before it could finish. Re-run the job to continue.";

/**
 * Persists a new data-job run record.
 *
 * @param run The data-job run payload to store.
 * @returns The created run id.
 */
export async function createDataJobRun(
  run: Omit<DataJobRun, "id" | "schemaVersion">,
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
  const snapshot = await getRequiredDocumentSnapshot(
    "Data job run",
    dataJobRunsCollection.doc(runId),
  );

  return normalizeDataJobRunDocument(snapshot.id, snapshot.data()!);
}

/**
 * Lists recent data-job runs sorted by start time descending.
 *
 * Runs left in `RUNNING` past the serverless execution window are marked as
 * failed while listing so a platform timeout does not leave the control panel
 * showing a job as permanently in progress.
 *
 * @param limit The maximum number of runs to return.
 * @returns The normalized data-job runs.
 */
export async function listDataJobRuns(limit = 20): Promise<DataJobRun[]> {
  const snapshot = await dataJobRunsCollection
    .orderBy("startedAt", "desc")
    .limit(limit)
    .get();

  const now = Date.now();
  const staleRunIds = new Set(
    snapshot.docs
      .filter((doc) => {
        const data = doc.data();

        return (
          data.status === "RUNNING" &&
          now - data.startedAt.toMillis() >= STALE_RUN_THRESHOLD_MS
        );
      })
      .map((doc) => doc.id),
  );

  if (staleRunIds.size > 0) {
    const finishedAt = new Date();
    const batch = dataJobRunsCollection.firestore.batch();

    for (const doc of snapshot.docs) {
      if (!staleRunIds.has(doc.id)) {
        continue;
      }

      batch.update(doc.ref, {
        status: "FAILED",
        summary: "Job failed.",
        errorMessage: STALE_RUN_ERROR_MESSAGE,
        finishedAt,
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("Failed to mark stale data job runs as failed.", error);
    }
  }

  return snapshot.docs.map((doc) => {
    const run = normalizeDataJobRunDocument(doc.id, doc.data());

    if (!staleRunIds.has(doc.id)) {
      return run;
    }

    return {
      ...run,
      status: "FAILED",
      summary: "Job failed.",
      errorMessage: STALE_RUN_ERROR_MESSAGE,
      finishedAt: new Date(),
    };
  });
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
  await getRequiredDocumentSnapshot("Data job run", runRef);

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
  await getRequiredDocumentSnapshot("Data job run", runRef);

  await runRef.update({
    status: "FAILED",
    summary: "Job failed.",
    errorMessage,
    finishedAt: new Date(),
  });
}
