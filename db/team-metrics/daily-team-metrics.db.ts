import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { DailyTeamMetric } from "@/lib/domain/daily-team-metrics.types";
import {
  normalizeDailyTeamMetricDocument,
  serializeDailyTeamMetric,
} from "./daily-team-metrics.mapper";

const db = getAdminFirestore();

/**
 * Builds a daily-team-metric snapshot document id.
 *
 * @param teamId The stable team id.
 * @param capturedAt The exact snapshot timestamp.
 * @returns The daily team metric document id.
 */
export function getDailyTeamMetricSnapshotDocId(
  teamId: string,
  capturedAt: Date,
): string {
  return `${teamId}_${capturedAt.getTime()}`;
}

/**
 * Creates a daily unanswered-issues snapshot for a team.
 *
 * @param metric The daily team metric to persist.
 * @returns A promise that resolves when the document has been written.
 */
export async function createDailyTeamMetric(
  metric: DailyTeamMetric,
): Promise<void> {
  await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .doc(getDailyTeamMetricSnapshotDocId(metric.teamId, metric.capturedAt))
    .set(serializeDailyTeamMetric(metric));
}

/**
 * Lists daily team metrics for the given date key.
 *
 * @param dateKey The YYYY-MM-DD date key to fetch.
 * @returns The normalized metrics captured for that date.
 */
export async function getDailyTeamMetricsByDateKey(
  dateKey: string,
): Promise<DailyTeamMetric[]> {
  const snapshot = await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeDailyTeamMetricDocument(doc.data()),
  );
}

/**
 * Lists daily team metrics captured on or after the given date key.
 *
 * @param dateKey The inclusive YYYY-MM-DD lower-bound date key.
 * @returns The normalized metrics captured since that date key.
 */
export async function getDailyTeamMetricsSinceDateKey(
  dateKey: string,
): Promise<DailyTeamMetric[]> {
  const snapshot = await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .where("dateKey", ">=", dateKey)
    .orderBy("dateKey", "asc")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeDailyTeamMetricDocument(doc.data()),
  );
}
