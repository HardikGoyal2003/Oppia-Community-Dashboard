import type { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";

export type TeamLeadRole = Extract<UserRole, "TEAM_LEAD" | "LEAD_TRAINEE">;

export type TeamLead = {
  role: TeamLeadRole;
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
