import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type AssignedPR = {
  prNumber: number;
  title: string;
  url: string;
  waitingSince: string;
};

export type ReviewerTeamMember = {
  username: string;
  avatarUrl: string;
  assignedPRs: AssignedPR[];
};

export type ReviewerTeam = {
  teamSlug: string;
  teamName: string;
  description: string;
  members: ReviewerTeamMember[];
};

export type ReviewerTeamsDocument = {
  platform: ContributionPlatform;
  lastSyncedAt: Date;
  teams: ReviewerTeam[];
};
