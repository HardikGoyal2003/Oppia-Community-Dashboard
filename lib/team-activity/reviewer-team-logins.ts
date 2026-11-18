import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

const REVIEWER_TEAMS_PLATFORM: ContributionPlatform = "WEB";

/**
 * Returns the GitHub logins that currently belong to the reviewer teams.
 *
 * Reviewer docs and pending assignments are only meaningful for these
 * logins, so the cycle sync and the pending-review sync both filter to this
 * set.
 *
 * @returns The set of current reviewer logins.
 */
export async function getReviewerTeamLogins(): Promise<Set<string>> {
  const teamDoc = await getTeamReviewers(REVIEWER_TEAMS_PLATFORM);
  const logins = new Set<string>();

  if (!teamDoc) return logins;

  for (const team of teamDoc.teams) {
    for (const member of team.members) {
      logins.add(member.username);
    }
  }

  return logins;
}
