import { UserRole } from "../auth/auth.types";

export function isValidUserRole(role: string): role is UserRole {
  return [
    "CONTRIBUTOR",
    "TEAM_MEMBER",
    "LEAD_TRAINEE",
    "TEAM_LEAD",
    "ADMIN",
  ].includes(role);
}
