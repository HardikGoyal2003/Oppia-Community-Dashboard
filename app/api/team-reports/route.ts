import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getDailyTeamMetricsSinceDateKey } from "@/db/team-metrics/daily-team-metrics.db";
import { getTeams } from "@/db/teams/teams.db";
import type { TeamGfiCounts, TeamModel } from "@/lib/domain/teams.types";

type TeamReportNextStep = {
  message: string;
  priority: "high" | "medium";
  reason: string;
};

type TeamReport = TeamModel & {
  id: string;
  metrics: Array<{
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: TeamReportNextStep[];
};

function canViewTeamReports(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function getDateKeyDaysAgo(days: number): string {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - days);

  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  });

  return formatter.format(target);
}

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

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewTeamReports(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const sinceDateKey = getDateKeyDaysAgo(13);
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

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    reports,
  });
}
