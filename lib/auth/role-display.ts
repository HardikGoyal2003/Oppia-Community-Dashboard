import type { UserRole } from "./roles";
import { isUserRole } from "./roles";
import { ROLE_LABELS } from "./role-labels";

/**
 * Formats a role value for display using the canonical role labels when available.
 *
 * @param role The raw role value to format.
 * @returns The canonical role label, or a fallback display string for unknown values.
 */
export function getRoleDisplayLabel(role: string): string {
  if (isUserRole(role)) {
    return ROLE_LABELS[role];
  }

  return role.replace(/_/g, " ");
}

/**
 * Returns the display label for a known user role.
 *
 * @param role The validated role value.
 * @returns The canonical display label for the role.
 */
export function getKnownRoleDisplayLabel(role: UserRole): string {
  return ROLE_LABELS[role];
}
