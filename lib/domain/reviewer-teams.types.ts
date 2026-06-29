import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type ReviewerTeamMember = {
  username: string;
  avatarUrl: string;
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
