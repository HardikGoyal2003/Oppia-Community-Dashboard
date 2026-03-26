export const USER_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEAM_LEAD",
  "LEAD_TRAINEE",
  "TEAM_MEMBER",
  "CONTRIBUTOR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ASSIGNABLE_USER_ROLES: UserRole[] = [
  "CONTRIBUTOR",
  "TEAM_MEMBER",
  "LEAD_TRAINEE",
  "TEAM_LEAD",
  "ADMIN",
];

export const REQUESTABLE_USER_ROLES: UserRole[] = [
  "TEAM_MEMBER",
  "TEAM_LEAD",
  "ADMIN",
];

/**
 * Validates whether the provided value is a supported user role.
 *
 * @param role The raw role candidate.
 * @returns True when the value is a valid user role.
 */
export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}
