import type { SchemaVersioned } from "@/lib/domain/schema.types";

/* Team doc member (no PR data — just identity) */
export type TeamReviewerMember = {
  username: string;
  avatarUrl: string;
};

export type PendingReview = {
  prNumber: number;
  title: string;
  url: string;
  assignedAt: string;
};

export type TeamReviewerEntry = {
  teamSlug: string;
  teamName: string;
  description: string;
  members: TeamReviewerMember[];
};

export type TeamReviewersDocument = SchemaVersioned & {
  teams: TeamReviewerEntry[];
  lastUpdated: Date;
};

export type ReviewerDocument = SchemaVersioned & {
  teams: string[];
  pendingReviews: PendingReview[];
  /** Completed review cycles (assignment → first review or unassignment). */
  completedReviews: number;
  /** Distinct PRs the reviewer has reviewed at least once. */
  reviewedPrCount: number;
  /** Total non-pending review submissions across all cycles. */
  completedReviewSubmissions: number;
  /** PRs where this reviewer submitted at least one approval. */
  approvedPrCount: number;
  /** PRs authored by this reviewer (all states). */
  authoredPrCount: number;
  /** Average time from assignment to first review submission. */
  avgReviewTimeHours: number | null;
  /** Average time from assignment to first approval. */
  avgTimeToApprovalHours: number | null;
  avgReviewRoundsBeforeApproval: number | null;
  avgCommentsPerReview: number | null;
  /** Average completed review cycles per active week. */
  avgReviewsPerWeek: number | null;
  lastUpdated: Date;
};

export type ReviewCycleRecord = SchemaVersioned & {
  reviewerLogin: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  assignedAt: string;
  completedAt: string;
  durationMs: number;
  /**
   * PR-level metric: number of review rounds before this reviewer's first
   * approval on the PR, regardless of which cycle it landed in. Copied onto
   * every cycle record for the PR and deduplicated by PR when aggregating.
   */
  reviewRoundsBeforeApproval: number | null;
  /** PR-level metric: total review-body + inline comments by this reviewer. */
  commentCount: number;
  /**
   * PR-level metric: non-pending review submissions made by this reviewer on
   * the PR. Copied onto every cycle record for the PR.
   */
  reviewSubmissionCount: number;
  /** Timestamp of this reviewer's first approval on the PR, if any. */
  approvedAt: string | null;
  /** Per-cycle: assignment → first approval duration in ms, if attached. */
  approvalDurationMs: number | null;
  /** Lines added by the PR (size proxy). */
  prAdditions: number | null;
};

export type ReviewerTeamMember = {
  username: string;
  avatarUrl: string;
  assignedPRs: PendingReview[];
  /** Completed review cycles. */
  reviewsDone: number;
  /** Distinct PRs reviewed at least once. */
  reviewedPrCount: number;
  /** Total review submissions (reviews, not PRs). */
  completedReviewSubmissions: number;
  avgReviewTimeHours: number | null;
  avgTimeToApprovalHours: number | null;
  avgReviewRoundsBeforeApproval: number | null;
  avgCommentsPerReview: number | null;
  avgReviewsPerWeek: number | null;
  pendingReviews: number;
  pendingStaleCount: number;
  approvedPrCount: number;
  authoredPrCount: number;
  approvalToAuthoredRatio: number | null;
};

export type ReviewerWeeklyPoint = {
  weekStart: string;
  reviews: number;
};

export type ReviewerMonthlyUniquePoint = {
  month: string;
  uniqueReviewers: number;
};

export type ReviewerApprovalShare = {
  username: string;
  approvals: number;
  sharePct: number;
};

export type ReviewerPrSizePoint = {
  prNumber: number;
  additions: number;
  reviewTimeHours: number;
};

export type ReviewerTeamsAnalytics = SchemaVersioned & {
  weeklyReviews: ReviewerWeeklyPoint[];
  monthlyUniqueReviewers: ReviewerMonthlyUniquePoint[];
  topApprovers: ReviewerApprovalShare[];
  prSizeScatter: ReviewerPrSizePoint[];
  totalApprovals: number;
};

export type ReviewerTeam = {
  teamSlug: string;
  teamName: string;
  description: string;
  members: ReviewerTeamMember[];
};

export type ReviewerTeamsDocument = {
  platform: string;
  lastSyncedAt: Date;
  teams: ReviewerTeam[];
  analytics: ReviewerTeamsAnalytics;
};
