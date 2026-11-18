import { getArchivedDiscussions } from "@/db/archived-discussions/archived-discussions.db";
import type { ArchivedDiscussionRecord } from "@/db/archived-discussions/archived-discussions.mapper";
import { createDailyDiscussionMetric } from "@/db/daily-discussion-metrics/daily-discussion-metrics.db";
import {
  CONTRIBUTION_PLATFORMS,
  type ContributionPlatform,
} from "@/lib/auth/auth.types";
import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { fetchUnansweredDiscussions } from "@/lib/github/github-unanswered-discussions.fetcher";
import type { GitHubDiscussion } from "@/lib/github/github.types";
import { compareDateInputs, getIstDateKey } from "@/lib/utils/date.utils";

type DiscussionMetricCaptureSummary = {
  capturedAt: Date;
  dateKey: string;
  platforms: Array<{
    platform: ContributionPlatform;
    unansweredDiscussionsCount: number;
  }>;
};

const PLATFORMS = CONTRIBUTION_PLATFORMS;

/**
 * Counts live unanswered discussions that are not currently archived.
 *
 * A discussion stays hidden while it is archived unless it has received new
 * activity after it was archived, which mirrors the dashboard's auto-unarchive
 * behavior.
 *
 * @param liveDiscussions The currently fetched unanswered discussions.
 * @param archivedDiscussions The archived discussions stored for the platform.
 * @returns The number of discussions that should be counted as unanswered.
 */
function countVisibleDiscussions(
  liveDiscussions: GitHubDiscussion[],
  archivedDiscussions: ArchivedDiscussionRecord[],
): number {
  const archivedByNumber = new Map(
    archivedDiscussions.map((discussion) => [
      discussion.discussionNumber,
      discussion,
    ]),
  );

  return liveDiscussions.filter((discussion) => {
    const archived = archivedByNumber.get(discussion.discussionNumber);

    if (!archived) {
      return true;
    }

    if (!archived.archivedAt) {
      return false;
    }

    const comparison = compareDateInputs(
      discussion.lastCommentCreatedAt,
      archived.archivedAt,
    );

    return comparison !== null && comparison > 0;
  }).length;
}

/**
 * Captures one day's unanswered-discussions metric for a single platform.
 *
 * @param platform The platform to capture.
 * @param capturedAt The capture timestamp.
 * @param dateKey The IST-normalized date key.
 * @returns The captured platform summary.
 */
async function capturePlatformDiscussionMetric(
  platform: ContributionPlatform,
  capturedAt: Date,
  dateKey: string,
): Promise<DiscussionMetricCaptureSummary["platforms"][number]> {
  const [liveDiscussions, archivedDiscussions] = await Promise.all([
    fetchUnansweredDiscussions(GITHUB_REPOS[platform], platform),
    getArchivedDiscussions(platform),
  ]);

  const unansweredDiscussionsCount = countVisibleDiscussions(
    liveDiscussions,
    archivedDiscussions,
  );

  await createDailyDiscussionMetric({
    capturedAt,
    dateKey,
    platform,
    unansweredDiscussionsCount,
  });

  return { platform, unansweredDiscussionsCount };
}

/**
 * Captures a daily unanswered-discussions snapshot for every platform.
 *
 * @returns A summary of the persisted daily discussion metrics.
 */
export async function captureDailyDiscussionMetrics(): Promise<DiscussionMetricCaptureSummary> {
  const capturedAt = new Date();
  const dateKey = getIstDateKey(capturedAt);

  const platforms = await Promise.all(
    PLATFORMS.map((platform) =>
      capturePlatformDiscussionMetric(platform, capturedAt, dateKey),
    ),
  );

  return {
    capturedAt,
    dateKey,
    platforms,
  };
}
