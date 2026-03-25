import type { UserRole } from "../auth/roles";
import { isUserRole } from "../auth/roles";

export function isValidUserRole(role: string): role is UserRole {
  return isUserRole(role) && role !== "SUPER_ADMIN";
}
