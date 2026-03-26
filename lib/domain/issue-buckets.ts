import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { ANDROID_TEAMS, WEB_TEAMS } from "@/lib/config";

export type IssueBucket = "team1" | "team2" | "team3" | "others";

/**
 * Resolves the dashboard bucket for an issue based on its platform and linked project.
 *
 * @param platform The contribution platform associated with the issue.
 * @param linkedProject The linked GitHub project title for the issue.
 * @returns The issue bucket used by the dashboard UI.
 */
export function getIssueBucket(
  platform: ContributionPlatform,
  linkedProject: string,
): IssueBucket {
  if (platform === "ANDROID") {
    if (linkedProject === ANDROID_TEAMS.CLAM) {
      return "team1";
    }

    if (linkedProject === ANDROID_TEAMS.DEV_WORKFLOW_INFRA) {
      return "team2";
    }

    return "others";
  }

  if (linkedProject === WEB_TEAMS.LEAP) {
    return "team1";
  }

  if (linkedProject === WEB_TEAMS.CORE) {
    return "team2";
  }

  if (linkedProject === WEB_TEAMS.DEV_WORKFLOW) {
    return "team3";
  }

  return "others";
}
