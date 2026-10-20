/**
 * Temporary per-lead email overrides for digest and escalation delivery,
 * keyed by GitHub username.
 *
 * The dashboard normally uses the email stored on the user's Firestore record
 * (populated from GitHub OAuth, often null for private profiles). Maintainers
 * can populate this map for leads whose records have no usable email until
 * their addresses are available in Firestore.
 *
 * Example:
 * ```ts
 * export const LEAD_EMAIL_OVERRIDES: Record<string, string> = {
 *   octocat: "octocat@example.com",
 * };
 * ```
 */
export const LEAD_EMAIL_OVERRIDES: Record<string, string> = {};

/** Shared team inboxes used for action-item nudges. */
export const TEAM_LEAD_EMAILS: Record<string, string> = {
  CLAM: "android-clam-leads@oppia.org",
  DEV_WORKFLOW_INFRA: "android-dev-workflow-leads@oppia.org",
  LEAP: "web-leap-leads@oppia.org",
  CORE: "web-core-leads@oppia.org",
  DEV_WORKFLOW: "web-dev-workflow-leads@oppia.org",
};

/**
 * Resolves the shared team inbox for action-item notifications.
 *
 * @param teamKey The team key stored on user records.
 * @returns The team inbox, or null when none is configured.
 */
export function resolveTeamLeadEmail(teamKey: string): string | null {
  return TEAM_LEAD_EMAILS[teamKey]?.trim() || null;
}

/**
 * Resolves the best-known email for a lead: the explicit override first, then
 * the email on their user record.
 *
 * @param githubUsername The lead's GitHub username (override key).
 * @param recordEmail The email stored on the user's Firestore record.
 * @returns The email to deliver to, or null when none is known.
 */
export function resolveLeadEmail(
  githubUsername: string,
  recordEmail: string | null,
): string | null {
  const override = LEAD_EMAIL_OVERRIDES[githubUsername]?.trim();

  if (override) {
    return override;
  }

  return recordEmail?.trim() ? recordEmail.trim() : null;
}
