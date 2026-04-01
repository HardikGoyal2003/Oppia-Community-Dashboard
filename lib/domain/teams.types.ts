import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type TeamLead = {
  uid: string;
  username: string;
};

export type TeamGfiCounts = {
  backend: number;
  frontend: number;
  fullstack: number;
  uncategorized: number;
};

export type TeamModel = {
  gfiCounts: TeamGfiCounts;
  lastUpdated: Date;
  leads: TeamLead[];
  platform: ContributionPlatform;
  teamName: string;
};
