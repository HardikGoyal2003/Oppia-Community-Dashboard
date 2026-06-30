import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewer } from "@/db/reviewers/reviewers.db";
import { getReviewCycleAggregates } from "@/db/review-cycles/review-cycles.db";
import type { TeamReviewerMember } from "@/lib/domain/reviewer-teams.types";

function canViewReviewerTeams(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewReviewerTeams(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const doc = await getTeamReviewers("WEB");

  if (!doc) {
    return NextResponse.json(
      {
        error:
          "No reviewer teams data found. Run the Sync Reviewer Reports cron job first.",
      },
      { status: 404 },
    );
  }

  const teams = await Promise.all(
    doc.teams
      .slice()
      .sort((a, b) => a.teamName.localeCompare(b.teamName))
      .map(async (team) => {
        const members = await Promise.all(
          team.members.map(async (member: TeamReviewerMember) => {
            const reviewer = await getReviewer(member.username);
            const cycleAgg = await getReviewCycleAggregates(member.username);

            const pendingReviews = (reviewer?.pendingReviews ?? [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.assignedAt).getTime() -
                  new Date(b.assignedAt).getTime(),
              );

            const reviewsDone = cycleAgg.reviewsDone;
            const avgReviewTimeHours =
              reviewsDone > 0
                ? Number(
                    (
                      cycleAgg.totalReviewTimeMs /
                      reviewsDone /
                      3_600_000
                    ).toFixed(1),
                  )
                : null;

            return {
              username: member.username,
              avatarUrl: member.avatarUrl,
              assignedPRs: pendingReviews,
              reviewsDone,
              pendingReviews: pendingReviews.length,
              avgReviewTimeHours,
            };
          }),
        );

        return {
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          description: team.description,
          assignedPRs: team.teamAssignedPRs
            .slice()
            .sort(
              (a, b) =>
                new Date(a.assignedAt).getTime() -
                new Date(b.assignedAt).getTime(),
            ),
          members,
        };
      }),
  );

  const response = {
    platform: "WEB",
    lastSyncedAt: doc.lastUpdated,
    teams,
  };

  return NextResponse.json(response);
}
