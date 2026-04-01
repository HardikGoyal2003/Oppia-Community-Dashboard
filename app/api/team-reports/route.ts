import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getDailyTeamMetricsSinceDateKey } from "@/db/team-metrics/daily-team-metrics.db";
import { getTeams } from "@/db/teams/teams.db";
import type { TeamModel } from "@/lib/domain/teams.types";

type TeamReport = TeamModel & {
  id: string;
  metrics: Array<{
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: string[];
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

function getNextSteps(team: TeamReport): string[] {
  const nextSteps: string[] = [];
  const totalGfis =
    team.gfiCounts.frontend +
    team.gfiCounts.backend +
    team.gfiCounts.fullstack +
    team.gfiCounts.uncategorized;
  const recentTrend = team.metrics
    .slice(-3)
    .map((metric) => metric.unansweredIssuesCount);

  if (team.leads.length < 2) {
    nextSteps.push("Onboard one more lead in this team.");
  }

  if (totalGfis < 3) {
    nextSteps.push("Ask leads to add more good first issues in this team.");
  }

  if (
    recentTrend.length === 3 &&
    recentTrend[0] < recentTrend[1] &&
    recentTrend[1] < recentTrend[2]
  ) {
    nextSteps.push(
      "Ask leads about the team’s issue response performance because unanswered issues are consistently growing.",
    );
  }

  if (team.gfiCounts.uncategorized > 0) {
    nextSteps.push(
      "Ask leads to categorize uncategorized good first issues into frontend, backend, or fullstack.",
    );
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
      .map((metric) => ({
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
