import type { UserRole } from "@/lib/auth/roles";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  CONTRIBUTOR: "Contributor",
  TEAM_MEMBER: "Team Member",
  LEAD_TRAINEE: "Lead Trainee",
  TEAM_LEAD: "Team Lead",
  ADMIN: "Admin",
};
