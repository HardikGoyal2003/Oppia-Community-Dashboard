import { getDailyTeamMetricsSinceDateKey } from "@/db/team-metrics/daily-team-metrics.db";
import { getTeams } from "@/db/teams/teams.db";
import type { TeamGfiCounts, TeamModel } from "@/lib/domain/teams.types";
import { getIstDateKeyDaysAgo } from "@/lib/utils/date.utils";

export type TeamReportNextStep = {
  message: string;
  priority: "high" | "medium";
  reason: string;
};

export type TeamReport = TeamModel & {
  id: string;
  metrics: Array<{
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: TeamReportNextStep[];
};

export type TeamReportsSnapshot = {
  generatedAt: string;
  reports: TeamReport[];
};

/**
 * Returns the tracked GFI domains that are below the minimum threshold.
 *
 * @param gfiCounts The current GFI counts for a team.
 * @returns The list of domain shortfalls with required counts.
 */
function getLowGfiDomainShortfalls(gfiCounts: TeamGfiCounts): Array<{
  countNeeded: number;
  domain: string;
}> {
  const shortfalls: Array<{ countNeeded: number; domain: string }> = [];

  if (gfiCounts.frontend < 5) {
    shortfalls.push({
      countNeeded: 5 - gfiCounts.frontend,
      domain: "frontend",
    });
  }

  if (gfiCounts.backend < 5) {
    shortfalls.push({
      countNeeded: 5 - gfiCounts.backend,
      domain: "backend",
    });
  }

  if (gfiCounts.fullstack < 5) {
    shortfalls.push({
      countNeeded: 5 - gfiCounts.fullstack,
      domain: "fullstack",
    });
  }

  return shortfalls;
}

/**
 * Derives recommended next steps for a team report based on staffing, GFI coverage, and trend data.
 *
 * @param team The report to evaluate.
 * @returns The ordered list of recommended next steps.
 */
function getNextSteps(team: TeamReport): TeamReportNextStep[] {
  const nextSteps: TeamReportNextStep[] = [];
  const recentTrend = team.metrics
    .slice(-3)
    .map((metric) => metric.unansweredIssuesCount);
  const lowGfiDomainShortfalls = getLowGfiDomainShortfalls(team.gfiCounts);
  const traineeLeadCount = team.leads.filter(
    (lead) => lead.role === "LEAD_TRAINEE",
  ).length;

  if (team.leads.length < 2) {
    nextSteps.push({
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
      message: "It is better to onboard one trainee lead in this team.",
      priority: "medium",
      reason:
        "A trainee lead helps build a stronger lead pipeline and reduces risk if the current leads become unavailable.",
    });
  }

  if (lowGfiDomainShortfalls.length > 0) {
    nextSteps.push({
      message: `Ask leads to add ${lowGfiDomainShortfalls
        .map(
          ({ countNeeded, domain }) =>
            `${countNeeded} more ${domain} GFI${countNeeded === 1 ? "" : "s"}`,
        )
        .join(", ")}.`,
      priority: "high",
      reason:
        "Each tracked domain should have at least 5 good first issues so new contributors can find enough well-scoped starter work.",
    });
  }

  if (
    recentTrend.length === 3 &&
    recentTrend[0] < recentTrend[1] &&
    recentTrend[1] < recentTrend[2]
  ) {
    nextSteps.push({
      message:
        "Ask leads about the team’s issue response performance because unanswered issues are consistently growing.",
      priority: "high",
      reason:
        "A steadily rising unanswered issue trend usually signals a support bottleneck that needs attention before it grows further.",
    });
  }

  if (team.gfiCounts.uncategorized > 0) {
    nextSteps.push({
      message:
        "Ask leads to categorize uncategorized good first issues into frontend, backend, or fullstack.",
      priority: "medium",
      reason:
        "Categorized good first issues are easier for contributors to discover, choose, and self-select based on their skills.",
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
  const [teams, metrics] = await Promise.all([
    getTeams(),
    getDailyTeamMetricsSinceDateKey(sinceDateKey),
  ]);

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
      }));

    const report: TeamReport = {
      ...team,
      metrics: teamMetrics,
      nextSteps: [],
    };

    return {
      ...report,
      nextSteps: getNextSteps(report),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    reports,
  };
}
