import { getDailyDiscussionMetricsSinceDateKey } from "@/db/discussion-metrics/daily-discussion-metrics.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getIstDateKeyDaysAgo } from "@/lib/utils/date.utils";

/** Number of reporting days returned for the discussions-over-time chart. */
const DISCUSSION_METRIC_HISTORY_DAYS = 14;

export type DiscussionMetricPoint = {
  capturedAt: string;
  dateKey: string;
  unansweredDiscussionsCount: number;
};

/**
 * Returns the recent unanswered-discussion history for a platform.
 *
 * @param platform The contribution platform to read.
 * @returns The metric points ordered oldest to newest.
 */
export async function getDiscussionMetricHistory(
  platform: ContributionPlatform,
): Promise<DiscussionMetricPoint[]> {
  const sinceDateKey = getIstDateKeyDaysAgo(DISCUSSION_METRIC_HISTORY_DAYS - 1);
  const metrics = await getDailyDiscussionMetricsSinceDateKey(
    platform,
    sinceDateKey,
  );

  return metrics
    .sort(
      (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime(),
    )
    .map((metric) => ({
      capturedAt: metric.capturedAt.toISOString(),
      dateKey: metric.dateKey,
      unansweredDiscussionsCount: metric.unansweredDiscussionsCount,
    }));
}
