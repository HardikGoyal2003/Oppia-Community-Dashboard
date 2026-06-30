import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type AssignedPR = {
  prNumber: number;
  title: string;
  url: string;
  assignedAt: string;
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
  assignedPRs: AssignedPR[];
  members: ReviewerTeamMember[];
};

export type ReviewerTeamsDocument = {
  platform: ContributionPlatform;
  lastSyncedAt: Date;
  teams: ReviewerTeam[];
};
