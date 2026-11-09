import { createDailyDiscussionMetric } from "@/db/discussion-metrics/daily-discussion-metrics.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getIstDateKey } from "@/lib/utils/date.utils";
import { getFixedIstCaptureDate } from "./dummy-data.utils";

export type DiscussionMetricsDummyDataSummary = {
  discussionMetricsWritten: number;
};

const SAMPLE_UNANSWERED_DISCUSSIONS: Record<ContributionPlatform, number[]> = {
  WEB: [5, 6, 7, 6, 8, 9, 8, 7, 9, 10],
  ANDROID: [2, 3, 2, 4, 3, 4, 5, 4, 3, 4],
};

/**
 * Seeds deterministic sample daily discussion metrics for local chart development.
 *
 * @returns A summary of the written discussion metric documents.
 */
export async function generateDiscussionMetricsDummyData(): Promise<DiscussionMetricsDummyDataSummary> {
  let discussionMetricsWritten = 0;

  for (const [platform, series] of Object.entries(
    SAMPLE_UNANSWERED_DISCUSSIONS,
  ) as Array<[ContributionPlatform, number[]]>) {
    for (const [index, unansweredDiscussionsCount] of series.entries()) {
      const capturedAt = getFixedIstCaptureDate(series.length - index - 1);

      await createDailyDiscussionMetric({
        capturedAt,
        dateKey: getIstDateKey(capturedAt),
        platform,
        unansweredDiscussionsCount,
      });

      discussionMetricsWritten += 1;
    }
  }

  return { discussionMetricsWritten };
}
