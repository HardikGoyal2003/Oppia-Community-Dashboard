import {
  deleteLegacyResolvedUnregisteredMembers,
  getUnregisteredMembers,
  saveUnregisteredMemberChanges,
} from "@/db/unregistered-members/unregistered-members.db";
import type { UnregisteredMemberWrite } from "@/db/unregistered-members/unregistered-members.types";
import { getAllUsers } from "@/db/users/users.db";
import { TEAM_ROSTER_SOURCES } from "@/lib/config/team-roster.constants";
import { TEAM_DEFINITIONS_BY_KEY } from "@/lib/domain/team-definitions";
import { fetchTeamRoster } from "@/lib/team-roster/team-roster.fetcher";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

/** Outcome for one team's roster reconciliation. */
export type TeamRosterSyncTeamSummary = {
  activeMemberCount: number;
  deletedCount: number;
  error: string | null;
  missingCount: number;
  newlyFlaggedCount: number;
  platform: ContributionPlatform;
  teamKey: string;
  teamName: string;
};

/** Summary returned by the daily roster reconciliation cron. */
export type TeamRosterSyncSummary = {
  finishedAt: string;
  startedAt: string;
  teams: TeamRosterSyncTeamSummary[];
  totalOpenCount: number;
};

/**
 * Builds the stable document id for a roster gap.
 *
 * @param teamKey The team key stored on user records.
 * @param normalizedUsername The normalized GitHub username.
 * @returns The roster-gap document id.
 */
function buildRosterGapId(teamKey: string, normalizedUsername: string): string {
  return `${teamKey}__${normalizedUsername}`;
}

/**
 * Reconciles each configured public team roster against dashboard users.
 *
 * Active roster members without a user account, or whose account is still
 * marked as alumni, are stored as open items. Their documents are deleted when
 * the person registers or leaves the active roster. A team whose sheet cannot
 * be read is skipped entirely, so a transient outage never deletes or creates
 * items for that team.
 *
 * @returns A summary of the run for cron and control-panel reporting.
 */
export async function syncTeamRoster(): Promise<TeamRosterSyncSummary> {
  const startedAt = new Date();
  await deleteLegacyResolvedUnregisteredMembers();

  const [storedItems, users] = await Promise.all([
    getUnregisteredMembers(),
    getAllUsers(),
  ]);
  const storedById = new Map(storedItems.map((item) => [item.id, item]));

  const registeredUsernames = new Set<string>();

  for (const user of users) {
    const normalizedUsername = normalizeGithubUsername(user.githubUsername);

    if (!normalizedUsername) {
      continue;
    }

    // Alumni accounts do not count as active registrations, so they stay flagged.
    if (user.role !== "ALUMNI") {
      registeredUsernames.add(normalizedUsername);
    }
  }

  const upserts: UnregisteredMemberWrite[] = [];
  const deleteIds: string[] = [];
  const touchedIds = new Set<string>();
  const successfulTeamKeys = new Set<string>();
  const deletedCountByTeam = new Map<string, number>();
  const teams: TeamRosterSyncTeamSummary[] = [];

  for (const source of TEAM_ROSTER_SOURCES) {
    let members;

    try {
      members = await fetchTeamRoster(source);
    } catch (error) {
      teams.push({
        activeMemberCount: 0,
        deletedCount: 0,
        error:
          error instanceof Error ? error.message : "Unknown roster sync error.",
        missingCount: 0,
        newlyFlaggedCount: 0,
        platform: source.platform,
        teamKey: source.teamKey,
        teamName:
          TEAM_DEFINITIONS_BY_KEY[source.teamKey]?.teamName ?? source.teamKey,
      });
      continue;
    }

    successfulTeamKeys.add(source.teamKey);
    let newlyFlaggedCount = 0;

    for (const member of members) {
      const normalizedUsername = normalizeGithubUsername(member.githubUsername);

      if (!normalizedUsername || registeredUsernames.has(normalizedUsername)) {
        continue;
      }

      const id = buildRosterGapId(source.teamKey, normalizedUsername);
      const prior = storedById.get(id);

      if (!prior) {
        newlyFlaggedCount += 1;
      }

      touchedIds.add(id);
      upserts.push({
        createdAt: prior?.createdAt ?? startedAt,
        email: member.email,
        fullName: member.fullName,
        githubUsername: member.githubUsername,
        id,
        platform: source.platform,
        teamKey: source.teamKey,
        updatedAt: startedAt,
      });
    }

    teams.push({
      activeMemberCount: members.length,
      deletedCount: 0,
      error: null,
      missingCount: upserts.filter((item) => item.teamKey === source.teamKey)
        .length,
      newlyFlaggedCount,
      platform: source.platform,
      teamKey: source.teamKey,
      teamName:
        TEAM_DEFINITIONS_BY_KEY[source.teamKey]?.teamName ?? source.teamKey,
    });
  }

  for (const item of storedItems) {
    if (!successfulTeamKeys.has(item.teamKey) || touchedIds.has(item.id)) {
      continue;
    }

    deleteIds.push(item.id);
    deletedCountByTeam.set(
      item.teamKey,
      (deletedCountByTeam.get(item.teamKey) ?? 0) + 1,
    );
  }

  for (const team of teams) {
    team.deletedCount = deletedCountByTeam.get(team.teamKey) ?? 0;
  }

  if (upserts.length > 0 || deleteIds.length > 0) {
    await saveUnregisteredMemberChanges({ deleteIds, upserts });
  }

  return {
    finishedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    teams,
    totalOpenCount: upserts.length,
  };
}
