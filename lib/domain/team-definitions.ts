import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config/teams.constants";

export type TeamDefinition = {
  linkedProject: string;
  platform: ContributionPlatform;
  teamId: string;
  teamKey: string;
  teamName: string;
};

export const TEAM_DEFINITIONS = [
  {
    linkedProject: WEB_TEAMS.LEAP,
    platform: "WEB",
    teamId: "WEB_LEAP",
    teamKey: "LEAP",
    teamName: WEB_TEAMS.LEAP,
  },
  {
    linkedProject: WEB_TEAMS.CORE,
    platform: "WEB",
    teamId: "WEB_CORE",
    teamKey: "CORE",
    teamName: WEB_TEAMS.CORE,
  },
  {
    linkedProject: WEB_TEAMS.DEV_WORKFLOW,
    platform: "WEB",
    teamId: "WEB_DEV_WORKFLOW",
    teamKey: "DEV_WORKFLOW",
    teamName: WEB_TEAMS.DEV_WORKFLOW,
  },
  {
    linkedProject: ANDROID_TEAMS.CLAM,
    platform: "ANDROID",
    teamId: "ANDROID_CLAM",
    teamKey: "CLAM",
    teamName: ANDROID_TEAMS.CLAM,
  },
  {
    linkedProject: ANDROID_TEAMS.DEV_WORKFLOW_INFRA,
    platform: "ANDROID",
    teamId: "ANDROID_DEV_WORKFLOW_INFRA",
    teamKey: "DEV_WORKFLOW_INFRA",
    teamName: ANDROID_TEAMS.DEV_WORKFLOW_INFRA,
  },
] as const satisfies readonly TeamDefinition[];

export const TEAM_KEYS: readonly string[] = Object.freeze(
  TEAM_DEFINITIONS.map((team) => team.teamKey),
);

/**
 * Builds a frozen lookup for a team definition field.
 *
 * @param getKey The field to index each definition by.
 * @returns A frozen record keyed by the selected field.
 */
function indexTeamDefinitions(
  getKey: (team: TeamDefinition) => string,
): Readonly<Record<string, TeamDefinition>> {
  return Object.freeze(
    Object.fromEntries(TEAM_DEFINITIONS.map((team) => [getKey(team), team])),
  );
}

/** Team definitions indexed by their stable Firestore team id. */
export const TEAM_DEFINITIONS_BY_ID = indexTeamDefinitions(
  (team) => team.teamId,
);

/** Team definitions indexed by the team key stored on user records. */
export const TEAM_DEFINITIONS_BY_KEY = indexTeamDefinitions(
  (team) => team.teamKey,
);

/** Team definitions indexed by their linked GitHub project name. */
export const TEAM_DEFINITIONS_BY_LINKED_PROJECT = indexTeamDefinitions(
  (team) => team.linkedProject,
);
