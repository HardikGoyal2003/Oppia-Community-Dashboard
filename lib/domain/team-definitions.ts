import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config/teams.constants";

export type TeamDefinition = {
  linkedProject: string;
  platform: ContributionPlatform;
  teamId: string;
  teamKey: string;
  teamName: string;
};

export const TEAM_DEFINITIONS: TeamDefinition[] = [
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
];

export const TEAM_KEYS = TEAM_DEFINITIONS.map((team) => team.teamKey);
