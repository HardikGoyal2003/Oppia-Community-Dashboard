import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { DailyTeamMetric } from "@/lib/domain/daily-team-metrics.types";
import {
  normalizeDailyTeamMetricDocument,
  serializeDailyTeamMetric,
} from "./daily-team-metrics.mapper";

const db = getAdminFirestore();

/**
 * Builds the daily team-metric document id.
 *
 * @param teamId The stable team id.
 * @param dateKey The YYYY-MM-DD date key.
 * @returns The daily team metric document id.
 */
export function getDailyTeamMetricDocId(
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
export async function upsertDailyTeamMetric(
  metric: DailyTeamMetric,
): Promise<void> {
  await db
    .collection(DB_PATHS.DAILY_TEAM_METRICS.COLLECTION)
    .doc(getDailyTeamMetricDocId(metric.teamId, metric.dateKey))
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
