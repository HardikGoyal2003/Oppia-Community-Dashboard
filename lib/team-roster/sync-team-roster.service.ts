import {
  getUnregisteredMembers,
  saveUnregisteredMemberChanges,
} from "@/db/unregistered-members/unregistered-members.db";
import type {
  UnregisteredMemberResolution,
  UnregisteredMemberWrite,
} from "@/db/unregistered-members/unregistered-members.types";
import { getAllUsers } from "@/db/users/users.db";
import { TEAM_ROSTER_SOURCES } from "@/lib/config/team-roster.constants";
import { TEAM_DEFINITIONS_BY_KEY } from "@/lib/domain/team-definitions";
import { fetchTeamRoster } from "@/lib/team-roster/team-roster.fetcher";
import { normalizeGithubUsername } from "@/lib/utils/username.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

/** Outcome for one team's roster reconciliation. */
export type TeamRosterSyncTeamSummary = {
  activeMemberCount: number;
  error: string | null;
  missingCount: number;
  newlyFlaggedCount: number;
  platform: ContributionPlatform;
  resolvedCount: number;
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
 * marked as alumni, are stored as open items. Items are resolved automatically
 * when the person registers or leaves the active roster. A team whose sheet
 * cannot be read is skipped entirely, so a transient outage never closes or
 * opens items for that team.
 *
 * @returns A summary of the run for cron and control-panel reporting.
 */
export async function syncTeamRoster(): Promise<TeamRosterSyncSummary> {
  const startedAt = new Date();
  const [storedItems, users] = await Promise.all([
    getUnregisteredMembers(),
    getAllUsers(),
  ]);
  const storedById = new Map(storedItems.map((item) => [item.id, item]));

  const registeredUsernames = new Set<string>();
  const alumniUsernames = new Set<string>();

  for (const user of users) {
    const normalizedUsername = normalizeGithubUsername(user.githubUsername);

    if (!normalizedUsername) {
      continue;
    }

    if (user.role === "ALUMNI") {
      alumniUsernames.add(normalizedUsername);
    } else {
      registeredUsernames.add(normalizedUsername);
    }
  }

  const upserts: UnregisteredMemberWrite[] = [];
  const resolutions: Array<{
    id: string;
    resolution: UnregisteredMemberResolution;
    resolvedAt: Date;
  }> = [];
  const touchedIds = new Set<string>();
  const activeRosterUsernames = new Set<string>();
  const resolvedCountByTeam = new Map<string, number>();
  const teams: TeamRosterSyncTeamSummary[] = [];

  for (const source of TEAM_ROSTER_SOURCES) {
    let members;

    try {
      members = await fetchTeamRoster(source);
    } catch (error) {
      teams.push({
        activeMemberCount: 0,
        error:
          error instanceof Error ? error.message : "Unknown roster sync error.",
        missingCount: 0,
        newlyFlaggedCount: 0,
        platform: source.platform,
        resolvedCount: 0,
        teamKey: source.teamKey,
        teamName:
          TEAM_DEFINITIONS_BY_KEY[source.teamKey]?.teamName ?? source.teamKey,
      });
      continue;
    }

    let newlyFlaggedCount = 0;

    for (const member of members) {
      const normalizedUsername = normalizeGithubUsername(member.githubUsername);

      if (!normalizedUsername) {
        continue;
      }

      activeRosterUsernames.add(normalizedUsername);

      if (registeredUsernames.has(normalizedUsername)) {
        continue;
      }

      const id = buildRosterGapId(source.teamKey, normalizedUsername);
      const prior = storedById.get(id);
      const reason = alumniUsernames.has(normalizedUsername)
        ? "ALUMNI_ACCOUNT"
        : "NOT_REGISTERED";

      if (!prior || prior.state === "RESOLVED") {
        newlyFlaggedCount += 1;
      }

      touchedIds.add(id);
      upserts.push({
        email: member.email,
        fullName: member.fullName,
        githubUsername: member.githubUsername,
        id,
        normalizedUsername,
        platform: source.platform,
        reason,
        resolution: null,
        resolvedAt: null,
        sheetStatus: member.status,
        state: "OPEN",
        teamKey: source.teamKey,
        createdAt: prior?.createdAt ?? startedAt,
        updatedAt: startedAt,
      });
    }

    teams.push({
      activeMemberCount: members.length,
      error: null,
      missingCount: upserts.filter((item) => item.teamKey === source.teamKey)
        .length,
      newlyFlaggedCount,
      platform: source.platform,
      resolvedCount: 0,
      teamKey: source.teamKey,
      teamName:
        TEAM_DEFINITIONS_BY_KEY[source.teamKey]?.teamName ?? source.teamKey,
    });
  }

  for (const item of storedItems) {
    if (item.state !== "OPEN" || touchedIds.has(item.id)) {
      continue;
    }

    resolutions.push({
      id: item.id,
      resolution: activeRosterUsernames.has(item.normalizedUsername)
        ? "REGISTERED"
        : "LEFT_ROSTER",
      resolvedAt: startedAt,
    });
    resolvedCountByTeam.set(
      item.teamKey,
      (resolvedCountByTeam.get(item.teamKey) ?? 0) + 1,
    );
  }

  for (const team of teams) {
    team.resolvedCount = resolvedCountByTeam.get(team.teamKey) ?? 0;
  }

  if (upserts.length > 0 || resolutions.length > 0) {
    await saveUnregisteredMemberChanges({ resolutions, upserts });
  }

  return {
    finishedAt: new Date().toISOString(),
    startedAt: startedAt.toISOString(),
    teams,
    totalOpenCount: upserts.length,
  };
}
