import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewers } from "@/db/reviewers/reviewers.db";
import { getReviewCycleAnalyticsSnapshot } from "@/db/review-cycles/review-cycles.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { REVIEWER_REPORT_PLATFORM } from "@/lib/team-activity/reviewer-platform.constants";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
import type {
  MyReviewerReport,
  PendingReview,
  ReviewerDocument,
  ReviewerTeamsAnalytics,
  ReviewerTeamsDocument,
  ReviewerTeamMember,
} from "@/lib/domain/reviewer-teams.types";

const PENDING_STALE_CUTOFF_HOURS = 48;

/** Error raised when reviewer-teams dashboard data is unavailable. */
export class ReviewerTeamsDataNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewerTeamsDataNotFoundError";
  }
}

/**
 * Builds an empty analytics payload for when no snapshot has been generated yet.
 *
 * @param platform The repository platform the analytics belong to.
 * @returns An analytics payload with no data.
 */
function emptyAnalytics(
  platform: ContributionPlatform,
): ReviewerTeamsAnalytics {
  return {
    platform,
    weeklyReviews: [],
    monthlyUniqueReviewers: [],
    topApprovers: [],
    prSizeScatter: [],
    totalApprovals: 0,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS),
  };
}

/**
 * Counts the reviewer's open assignments that have waited past the stale cutoff.
 *
 * @param pendingReviews The reviewer's open assignments.
 * @param nowMs The current timestamp in ms.
 * @returns The number of stale pending reviews.
 */
function countStalePendingReviews(
  pendingReviews: PendingReview[],
  nowMs: number,
): number {
  let staleCount = 0;

  for (const pr of pendingReviews) {
    const waitHours = (nowMs - new Date(pr.assignedAt).getTime()) / 3_600_000;

    if (waitHours >= PENDING_STALE_CUTOFF_HOURS) {
      staleCount++;
    }
  }

  return staleCount;
}

/**
 * Builds the per-member response payload from the stored reviewer doc.
 *
 * @param username The member's GitHub login.
 * @param avatarUrl The member's avatar URL.
 * @param reviewer The stored reviewer document, if any.
 * @param nowMs The current timestamp in ms.
 * @returns The enriched member payload.
 */
function buildMember(
  username: string,
  avatarUrl: string,
  reviewer: ReviewerDocument | null,
  nowMs: number,
): ReviewerTeamMember {
  const pendingReviews = (reviewer?.pendingReviews ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime(),
    );

  const approvedPrCount = reviewer?.approvedPrCount ?? 0;
  const authoredPrCount = reviewer?.authoredPrCount ?? 0;

  return {
    username,
    avatarUrl,
    assignedPRs: pendingReviews,
    reviewsDone: reviewer?.completedReviews ?? 0,
    reviewedPrCount: reviewer?.reviewedPrCount ?? 0,
    completedReviewSubmissions: reviewer?.completedReviewSubmissions ?? 0,
    avgReviewTimeHours: reviewer?.avgReviewTimeHours ?? null,
    avgTimeToApprovalHours: reviewer?.avgTimeToApprovalHours ?? null,
    avgReviewRoundsBeforeApproval:
      reviewer?.avgReviewRoundsBeforeApproval ?? null,
    avgCommentsPerReview: reviewer?.avgCommentsPerReview ?? null,
    avgReviewsPerWeek: reviewer?.avgReviewsPerWeek ?? null,
    pendingReviews: pendingReviews.length,
    pendingStaleCount: countStalePendingReviews(pendingReviews, nowMs),
    approvedPrCount,
    authoredPrCount,
    approvalToAuthoredRatio:
      authoredPrCount > 0
        ? Number((approvedPrCount / authoredPrCount).toFixed(2))
        : null,
  };
}

/**
 * Builds the reviewer-teams dashboard payload for the configured platform.
 *
 * @returns The assembled reviewer-teams dashboard document.
 * @throws {ReviewerTeamsDataNotFoundError} When team reviewer data is missing.
 */
export async function getReviewerTeamsDashboard(): Promise<ReviewerTeamsDocument> {
  const platform = REVIEWER_REPORT_PLATFORM;
  const doc = await getTeamReviewers(platform);

  if (!doc) {
    throw new ReviewerTeamsDataNotFoundError(
      "No reviewer teams data found. Run the Sync Reviewer Teams cron job, or generate reviewer dummy data from the control panel.",
    );
  }

  const memberLogins = Array.from(
    new Set(
      doc.teams.flatMap((team) =>
        team.members.map((member) => normalizeGithubUsername(member.username)),
      ),
    ),
  );

  const [reviewerMap, analyticsSnapshot] = await Promise.all([
    getReviewers(platform, memberLogins),
    getReviewCycleAnalyticsSnapshot(platform),
  ]);

  const analytics = analyticsSnapshot ?? emptyAnalytics(platform);
  const nowMs = Date.now();

  const teams = doc.teams
    .slice()
    .sort((a, b) => a.teamName.localeCompare(b.teamName))
    .map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((member) =>
        buildMember(
          member.username,
          member.avatarUrl,
          reviewerMap.get(normalizeGithubUsername(member.username)) ?? null,
          nowMs,
        ),
      ),
    }));

  return {
    platform,
    lastSyncedAt: doc.lastUpdated,
    teams,
    analytics,
  };
}

/**
 * Builds the report belonging to a single GitHub login for the current session.
 *
 * Reviewer identity comes from the synced reviewer documents rather than a
 * dashboard role, so the lookup is intentionally scoped to the supplied login.
 *
 * @param githubUsername The authenticated user's GitHub login.
 * @returns The reviewer's own report, or null when they are not in the synced
 * reviewer data.
 */
export async function getMyReviewerReport(
  githubUsername: string,
): Promise<MyReviewerReport | null> {
  const platform = REVIEWER_REPORT_PLATFORM;
  const login = normalizeGithubUsername(githubUsername);

  const [reviewerMap, teamReviewers] = await Promise.all([
    getReviewers(platform, [login]),
    getTeamReviewers(platform),
  ]);

  const reviewer = reviewerMap.get(login);
  if (!reviewer) {
    return null;
  }

  const avatarUrl =
    teamReviewers?.teams
      .flatMap((team) => team.members)
      .find((member) => normalizeGithubUsername(member.username) === login)
      ?.avatarUrl ?? "";

  return {
    platform,
    username: login,
    lastSyncedAt: reviewer.lastUpdated.toISOString(),
    teams: reviewer.teams,
    reviewer: buildMember(login, avatarUrl, reviewer, Date.now()),
  };
}
