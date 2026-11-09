import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyDiscussionMetric } from "@/lib/domain/daily-discussion-metrics.types";
import {
  type FirestoreDailyDiscussionMetric,
  normalizeDailyDiscussionMetricDocument,
  serializeDailyDiscussionMetric,
} from "./daily-discussion-metrics.mapper";

const db = getAdminFirestore();
const dailyDiscussionMetricsCollection = db.collection(
  DB_PATHS.DAILY_DISCUSSION_METRICS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreDailyDiscussionMetric>;

/**
 * Builds a daily-discussion-metric snapshot document id.
 *
 * @param platform The contribution platform the snapshot belongs to.
 * @param capturedAt The exact snapshot timestamp.
 * @returns The daily discussion metric document id.
 */
export function getDailyDiscussionMetricSnapshotDocId(
  platform: ContributionPlatform,
  capturedAt: Date,
): string {
  return `${platform}_${capturedAt.getTime()}`;
}

/**
 * Creates a daily unanswered-discussions snapshot for a platform.
 *
 * @param metric The daily discussion metric to persist.
 * @returns A promise that resolves when the document has been written.
 */
export async function createDailyDiscussionMetric(
  metric: Omit<DailyDiscussionMetric, "schemaVersion">,
): Promise<void> {
  await dailyDiscussionMetricsCollection
    .doc(
      getDailyDiscussionMetricSnapshotDocId(metric.platform, metric.capturedAt),
    )
    .set(serializeDailyDiscussionMetric(metric));
}

/**
 * Lists daily discussion metrics for a platform on or after the given date key.
 *
 * @param platform The contribution platform to fetch.
 * @param dateKey The inclusive YYYY-MM-DD lower-bound date key.
 * @returns The normalized metrics captured since that date key.
 */
export async function getDailyDiscussionMetricsSinceDateKey(
  platform: ContributionPlatform,
  dateKey: string,
): Promise<DailyDiscussionMetric[]> {
  const snapshot = await dailyDiscussionMetricsCollection
    .where("platform", "==", platform)
    .where("dateKey", ">=", dateKey)
    .orderBy("dateKey", "asc")
    .get();

  return snapshot.docs.map((doc) =>
    normalizeDailyDiscussionMetricDocument(doc.data()),
  );
}
