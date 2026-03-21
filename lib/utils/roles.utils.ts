import { UserRole } from "../auth/auth.types";

export function isValidUserRole(role: string): role is UserRole {
  return [
    "CONTRIBUTOR",
    "TEAM_MEMBER",
    "TEAM_LEAD",
    "ADMIN",
  ].includes(role);
}
