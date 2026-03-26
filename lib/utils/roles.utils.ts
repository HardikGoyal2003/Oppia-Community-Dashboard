import type { UserRole } from "../auth/roles";
import { isUserRole } from "../auth/roles";

/**
 * Validates whether the provided role may be assigned through normal app workflows.
 *
 * @param role The raw role candidate.
 * @returns True when the role is valid and assignable outside super-admin-only flows.
 */
export function isValidUserRole(role: string): role is UserRole {
  return isUserRole(role) && role !== "SUPER_ADMIN";
}
