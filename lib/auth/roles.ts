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
 * @param role The raw role candidate.
 * @returns True when the value is a valid user role.
 */
export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}
