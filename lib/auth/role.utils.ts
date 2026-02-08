import { UserRole } from "./auth.types";

/**
 * Role hierarchy (higher index = more power)
 */
const ROLE_PRIORITY: UserRole[] = [
  "CONTRIBUTOR",
  "TEAM_MEMBER",
  "TEAM_LEAD",
  "ADMIN",
];

/**
 * Check if a role has at least the required role
 */
export function hasAtLeastRole(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return (
    ROLE_PRIORITY.indexOf(userRole) >=
    ROLE_PRIORITY.indexOf(requiredRole)
  );
}

/**
 * Check if role is allowed explicitly
 */
export function isRoleAllowed(
  userRole: UserRole,
  allowedRoles: UserRole[]
): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Useful for UI gating
 */
export function isLead(role: UserRole): boolean {
  return role === "TEAM_LEAD" || role === "ADMIN";
}
