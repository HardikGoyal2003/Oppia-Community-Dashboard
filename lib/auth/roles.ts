export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEAM_LEAD",
  "LEAD_TRAINEE",
  "TEAM_MEMBER",
  "CONTRIBUTOR",
  "ALUMNI",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

/**
 * Roles an admin may assign through the role manager. `SUPER_ADMIN` is
 * intentionally excluded because it is not granted from the dashboard.
 */
export const ASSIGNABLE_USER_ROLES = [
  "CONTRIBUTOR",
  "TEAM_MEMBER",
  "LEAD_TRAINEE",
  "TEAM_LEAD",
  "ADMIN",
  "ALUMNI",
] as const satisfies readonly UserRole[];

/** Roles a contributor may request through the access-request flow. */
export const REQUESTABLE_USER_ROLES = [
  "TEAM_MEMBER",
  "TEAM_LEAD",
  "ADMIN",
] as const satisfies readonly UserRole[];

/** Roles a team lead may assign to members of their own team. */
export const TEAM_LEAD_ASSIGNABLE_ROLES = [
  "TEAM_MEMBER",
  "LEAD_TRAINEE",
  "ALUMNI",
] as const satisfies readonly UserRole[];

/**
 * Validates whether the provided value is a supported user role.
 *
 * This accepts every role, including `SUPER_ADMIN`. Use
 * {@link isAssignableUserRole} when checking roles that arrive from normal app
 * workflows.
 *
 * @param role The raw role candidate.
 * @returns True when the value is a valid user role.
 */
export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

/**
 * Returns whether the role is the super-admin role.
 *
 * @param role The role to check.
 * @returns True only for `SUPER_ADMIN`.
 */
export function isSuperAdminRole(role: UserRole): boolean {
  return role === "SUPER_ADMIN";
}

/**
 * Validates whether the provided role may be assigned through normal app
 * workflows.
 *
 * This intentionally excludes `SUPER_ADMIN`, which is never granted from the
 * dashboard. Keep all role-policy checks in this module so the distinction
 * between "valid role" and "assignable role" stays explicit.
 *
 * @param role The raw role candidate.
 * @returns True when the role is valid and assignable outside super-admin-only flows.
 */
export function isAssignableUserRole(role: string): role is UserRole {
  return isUserRole(role) && !isSuperAdminRole(role);
}

/**
 * Returns whether a team lead may assign the role to one of their members.
 *
 * @param role The role to check.
 * @returns True when the role is team-lead assignable.
 */
export function isTeamLeadAssignableRole(role: UserRole): boolean {
  return TEAM_LEAD_ASSIGNABLE_ROLES.some((allowed) => allowed === role);
}
