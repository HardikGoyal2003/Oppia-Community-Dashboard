import type { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

export type TeamLeadRole = Extract<UserRole, "TEAM_LEAD" | "LEAD_TRAINEE">;

export type TeamLead = {
  role: TeamLeadRole;
  uid: string;
  username: string;
};

export type TeamMember = {
  uid: string;
  username: string;
};

export type TeamModel = SchemaVersioned & {
  gfiCount: number;
  lastUpdated: Date;
  leads: TeamLead[];
  members: TeamMember[];
  platform: ContributionPlatform;
  teamName: string;
};
