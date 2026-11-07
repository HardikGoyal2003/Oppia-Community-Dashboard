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
