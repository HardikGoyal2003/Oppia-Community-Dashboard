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

export type TeamReviewersDocument = {
  teams: TeamReviewerEntry[];
  lastUpdated: Date;
};

export type ReviewerDocument = {
  teams: string[];
  pendingReviews: PendingReview[];
  completedReviews: number;
  avgReviewTimeHours: number | null;
  lastUpdated: Date;
};

export type ReviewCycleRecord = {
  reviewerLogin: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  assignedAt: string;
  completedAt: string;
  durationMs: number;
};

export type ReviewerTeamMember = {
  username: string;
  avatarUrl: string;
  assignedPRs: PendingReview[];
  reviewsDone: number;
  avgReviewTimeHours: number | null;
  pendingReviews: number;
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
};
