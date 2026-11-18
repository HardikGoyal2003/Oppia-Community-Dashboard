import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewers } from "@/db/reviewers/reviewers.db";
import { getReviewCycleAnalyticsSnapshot } from "@/db/review-cycles/review-cycles.db";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import type {
  PendingReview,
  ReviewerDocument,
  ReviewerTeamsAnalytics,
  ReviewerTeamsDocument,
  ReviewerTeamMember,
} from "@/lib/domain/reviewer-teams.types";

const PENDING_STALE_CUTOFF_HOURS = 48;

/**
 * Builds an empty analytics payload for when no snapshot has been generated
 * yet.
 *
 * Rebuilding analytics scans the whole review-cycle collection, so it is done
 * by a protected data job instead of a dashboard request. Until that job runs,
 * the UI shows its existing empty states.
 *
 * @returns An analytics payload with no data.
 */
function emptyAnalytics(): ReviewerTeamsAnalytics {
  return {
    weeklyReviews: [],
    monthlyUniqueReviewers: [],
    topApprovers: [],
    prSizeScatter: [],
    totalApprovals: 0,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.REVIEW_CYCLE_ANALYTICS),
  };
}

function canViewReviewerTeams(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Counts the reviewer's open assignments that have waited past the stale
 * cutoff.
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

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewReviewerTeams(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const doc = await getTeamReviewers("WEB");

  if (!doc) {
    return NextResponse.json(
      {
        error:
          "No reviewer teams data found. Run the Sync Reviewer Teams cron job, or generate reviewer dummy data from the control panel.",
      },
      { status: 404 },
    );
  }

  const memberLogins = doc.teams.flatMap((team) =>
    team.members.map((member) => member.username),
  );

  const [reviewerMap, analyticsSnapshot] = await Promise.all([
    getReviewers(memberLogins),
    getReviewCycleAnalyticsSnapshot(),
  ]);

  const analytics = analyticsSnapshot ?? emptyAnalytics();

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
          reviewerMap.get(member.username) ?? null,
          nowMs,
        ),
      ),
    }));

  const response: ReviewerTeamsDocument = {
    platform: "WEB",
    lastSyncedAt: doc.lastUpdated,
    teams,
    analytics,
  };

  return NextResponse.json(response);
}
