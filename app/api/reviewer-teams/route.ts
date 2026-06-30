import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { getReviewer } from "@/db/reviewers/reviewers.db";
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

            const pendingReviews = (reviewer?.pendingReviews ?? [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(a.assignedAt).getTime() -
                  new Date(b.assignedAt).getTime(),
              );

            return {
              username: member.username,
              avatarUrl: member.avatarUrl,
              assignedPRs: pendingReviews,
              reviewsDone: reviewer?.completedReviews ?? 0,
              pendingReviews: pendingReviews.length,
              avgReviewTimeHours: reviewer?.avgReviewTimeHours ?? null,
            };
          }),
        );

        return {
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          description: team.description,
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
