import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { DailyTeamMetric } from "@/lib/domain/team-metrics.types";
import {
  normalizeTeamMetricDailyDocument,
  serializeTeamMetricDaily,
} from "./team-metrics.mapper";

const db = getAdminFirestore();

/**
 * Builds the daily team-metric document id.
 *
 * @param teamId The stable team id.
 * @param dateKey The YYYY-MM-DD date key.
 * @returns The daily team metric document id.
 */
export function getTeamMetricDailyDocId(
  teamId: string,
  dateKey: string,
): string {
  return `${teamId}_${dateKey}`;
}

/**
 * Upserts a daily unanswered-issues metric for a team.
 *
 * @param metric The daily team metric to persist.
 * @returns A promise that resolves when the document has been written.
 */
export async function upsertTeamMetricDaily(
  metric: DailyTeamMetric,
): Promise<void> {
  await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .doc(getTeamMetricDailyDocId(metric.teamId, metric.dateKey))
    .set(serializeTeamMetricDaily(metric));
}

/**
 * Lists daily team metrics for the given date key.
 *
 * @param dateKey The YYYY-MM-DD date key to fetch.
 * @returns The normalized metrics captured for that date.
 */
export async function getTeamMetricsDailyByDateKey(
  dateKey: string,
): Promise<DailyTeamMetric[]> {
  const snapshot = await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .where("dateKey", "==", dateKey)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeTeamMetricDailyDocument(doc.data()),
  );
}
