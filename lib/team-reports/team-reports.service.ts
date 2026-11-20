import { getDailyTeamMetricsSinceDateKey } from "@/db/daily-team-metrics/daily-team-metrics.db";
import { getUnregisteredMembers } from "@/db/unregistered-members/unregistered-members.db";
import type { UnregisteredMemberRecord } from "@/db/unregistered-members/unregistered-members.types";
import { getTeams } from "@/db/teams/teams.db";
import {
  TEAM_DEFINITIONS_BY_ID,
  TEAM_DEFINITIONS_BY_KEY,
} from "@/lib/domain/team-definitions";
import type { TeamModel } from "@/lib/domain/teams.types";
import {
  CONTRIBUTION_PLATFORMS,
  type ContributionPlatform,
} from "@/lib/auth/auth.types";
import { getDiscussionMetricHistory } from "@/lib/discussion-metrics/discussion-metrics.service";
import { getIstDateKeyDaysAgo } from "@/lib/utils/date.utils";

/** Healthy pool size that each team should keep open for new contributors. */
const MINIMUM_GFI_POOL_SIZE = 15;

/** Unanswered discussions at or above this count are escalated to high priority. */
const HIGH_PRIORITY_DISCUSSION_COUNT = 3;

const PLATFORMS = CONTRIBUTION_PLATFORMS;

type UnansweredDiscussionsByPlatform = Record<ContributionPlatform, number>;

/**
 * Reads the latest unanswered-discussion count for every platform.
 *
 * @returns The current unanswered-discussion count keyed by platform.
 */
async function getLatestUnansweredDiscussionsByPlatform(): Promise<UnansweredDiscussionsByPlatform> {
  const counts = await Promise.all(
    PLATFORMS.map(async (platform) => {
      const history = await getDiscussionMetricHistory(platform);

      return [
        platform,
        history.at(-1)?.unansweredDiscussionsCount ?? 0,
      ] as const;
    }),
  );

  return Object.fromEntries(counts) as UnansweredDiscussionsByPlatform;
}

type TeamReportNextStep = {
  /**
   * Stable identifier for the rule that produced this step. Used to give
   * persisted action items a deterministic identity across syncs.
   */
  ruleKey: string;
  message: string;
  priority: "high" | "medium" | "low";
  reason: string;
};

export type TeamReport = TeamModel & {
  id: string;
  metrics: Array<{
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
    maxWaitingDays: number;
  }>;
  nextSteps: TeamReportNextStep[];
};

type TeamReportsSnapshot = {
  generatedAt: string;
  reports: TeamReport[];
};

/**
 * Builds the next step for team-sheet members without a dashboard account.
 *
 * @param members The people missing from this team's member sheet.
 * @returns The recommended next step.
 */
function getUnregisteredMembersNextStep(
  members: UnregisteredMemberRecord[],
): TeamReportNextStep {
  const usernames = members
    .map((member) => `@${member.githubUsername}`)
    .join(", ");
  const personLabel = members.length === 1 ? "person" : "people";
  const verb = members.length === 1 ? "is" : "are";

  return {
    ruleKey: "unregistered-members",
    message: `${members.length} ${personLabel} from the team sheet ${verb} not registered on the dashboard: ${usernames}.`,
    priority: "high",
    reason:
      "Everyone listed in the team member sheet should be registered on this dashboard so they can help with the team activities tracked here.",
  };
}

/**
 * Derives recommended next steps for a team report based on staffing, GFI coverage, and trend data.
 *
 * @param team The report to evaluate.
 * @param unansweredDiscussionsCount The latest unanswered-discussion count for the team's platform.
 * @param unregisteredMembers People missing from this team's member sheet.
 * @returns The ordered list of recommended next steps.
 */
function getNextSteps(
  team: TeamReport,
  unansweredDiscussionsCount: number,
  unregisteredMembers: UnregisteredMemberRecord[],
): TeamReportNextStep[] {
  const nextSteps: TeamReportNextStep[] = [];
  const totalGfiCount = team.gfiCount;
  const teamLeadCount = team.leads.filter(
    (lead) => lead.role === "TEAM_LEAD",
  ).length;
  const traineeLeadCount = team.leads.filter(
    (lead) => lead.role === "LEAD_TRAINEE",
  ).length;

  if (unregisteredMembers.length > 0) {
    nextSteps.push(getUnregisteredMembersNextStep(unregisteredMembers));
  }

  if (team.members.length < 4) {
    nextSteps.push({
      ruleKey: "min-members",
      message: "Onboard more team members in this team.",
      priority: "high",
      reason:
        "Each team should have at least 4 members so the team can sustain review, issue response, and contributor support.",
    });
  }

  if (teamLeadCount > 3) {
    nextSteps.push({
      ruleKey: "max-team-leads",
      message: `Reduce team leads in this team. There are ${teamLeadCount} team leads, but the ideal is at most 3.`,
      priority: "medium",
      reason:
        "Too many team leads can create unclear ownership and blur accountability.",
    });
  }

  if (traineeLeadCount > 2) {
    nextSteps.push({
      ruleKey: "max-trainee-leads",
      message: `Reduce trainee leads in this team. There are ${traineeLeadCount} trainee leads, but the ideal is at most 2.`,
      priority: "medium",
      reason:
        "Too many trainee leads can slow onboarding and make lead accountability unclear.",
    });
  }

  if (team.leads.length < 2) {
    nextSteps.push({
      ruleKey: "min-leads",
      message: `Onboard ${2 - team.leads.length} more lead${
        2 - team.leads.length === 1 ? "" : "s"
      } in this team.`,
      priority: "high",
      reason:
        "Each team should have at least 2 leads so the team can sustain review, issue response, and contributor support.",
    });
  }

  if (traineeLeadCount < 1) {
    nextSteps.push({
      ruleKey: "trainee-lead-pipeline",
      message: "It is better to onboard one trainee lead in this team.",
      priority: "medium",
      reason:
        "A trainee lead helps build a stronger lead pipeline and reduces risk if the current leads become unavailable.",
    });
  }

  if (totalGfiCount < MINIMUM_GFI_POOL_SIZE) {
    const countNeeded = MINIMUM_GFI_POOL_SIZE - totalGfiCount;

    nextSteps.push({
      ruleKey: "gfi-shortfall",
      message: `Add ${countNeeded} more GFI${countNeeded === 1 ? "" : "s"}.`,
      priority: "high",
      reason:
        "Each team should keep a healthy pool of good first issues so new contributors can consistently find starter work.",
    });
  }

  const latestMaxWaitingDays = team.metrics.at(-1)?.maxWaitingDays ?? 0;

  if (latestMaxWaitingDays > 2) {
    nextSteps.push({
      ruleKey: "issue-waiting-days",
      message:
        "Review the team\u2019s issue response performance because some issues have been waiting too long for a response.",
      priority: "high",
      reason:
        "Issues waiting more than 2 days for a response signal a support bottleneck that needs attention.",
    });
  }

  if (unansweredDiscussionsCount > 0) {
    nextSteps.push({
      ruleKey: "discussion-response",
      message:
        "Ask your team members to respond to unanswered discussions because some have been waiting too long for a reply.",
      priority:
        unansweredDiscussionsCount >= HIGH_PRIORITY_DISCUSSION_COUNT
          ? "high"
          : "medium",
      reason:
        "Unanswered discussions are missed opportunities to engage potential contributors. Timely replies keep the community active and help surface future team members for the codebase.",
    });
  }

  return nextSteps;
}

/**
 * Builds the current team-reports snapshot from stored team and metrics data.
 *
 * @returns The generated report snapshot for the last 14 reporting days.
 */
export async function getTeamReportsSnapshot(): Promise<TeamReportsSnapshot> {
  const sinceDateKey = getIstDateKeyDaysAgo(13);
  const [teams, metrics, unansweredDiscussionsByPlatform, unregisteredMembers] =
    await Promise.all([
      getTeams(),
      getDailyTeamMetricsSinceDateKey(sinceDateKey),
      getLatestUnansweredDiscussionsByPlatform(),
      getUnregisteredMembers(),
    ]);

  const unregisteredByTeamKey = new Map<string, UnregisteredMemberRecord[]>();

  for (const member of unregisteredMembers) {
    const existing = unregisteredByTeamKey.get(member.teamKey);

    if (existing) {
      existing.push(member);
    } else {
      unregisteredByTeamKey.set(member.teamKey, [member]);
    }
  }

  const reports: TeamReport[] = teams.map((team) => {
    const teamMetrics = metrics
      .filter((metric) => metric.teamId === team.id)
      .sort(
        (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime(),
      )
      .map((metric) => ({
        capturedAt: metric.capturedAt.toISOString(),
        dateKey: metric.dateKey,
        unansweredIssuesCount: metric.unansweredIssuesCount,
        maxWaitingDays: metric.maxWaitingDays,
      }));

    const report: TeamReport = {
      ...team,
      metrics: teamMetrics,
      nextSteps: [],
    };

    const teamKey = TEAM_DEFINITIONS_BY_ID[team.id]?.teamKey ?? team.id;

    return {
      ...report,
      nextSteps: getNextSteps(
        report,
        unansweredDiscussionsByPlatform[team.platform],
        unregisteredByTeamKey.get(teamKey) ?? [],
      ),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reports,
  };
}

/**
 * Returns the current report for a specific team assignment.
 *
 * @param teamKey The team key stored on the user record.
 * @param platform The contribution platform stored on the user record.
 * @returns The current team report when a matching team exists, or null.
 */
export async function getTeamReportForAssignment(
  teamKey: string,
  platform: ContributionPlatform,
): Promise<TeamReport | null> {
  const teamDefinition = TEAM_DEFINITIONS_BY_KEY[teamKey];

  if (!teamDefinition || teamDefinition.platform !== platform) {
    return null;
  }

  const snapshot = await getTeamReportsSnapshot();

  return (
    snapshot.reports.find((report) => report.id === teamDefinition.teamId) ??
    null
  );
}
