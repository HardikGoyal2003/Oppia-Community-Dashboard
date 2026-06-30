import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getReviewerTeamsDocument } from "@/db/reviewer-teams/reviewer-teams.db";

function canViewReviewerTeams(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewReviewerTeams(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const document = await getReviewerTeamsDocument("WEB");

  if (!document) {
    return NextResponse.json(
      {
        error:
          "No reviewer teams data found. Run the Sync Reviewer Teams cron job first.",
      },
      { status: 404 },
    );
  }

  const sorted = {
    ...document,
    teams: document.teams
      .slice()
      .sort((a, b) => a.teamName.localeCompare(b.teamName))
      .map((team) => ({
        ...team,
        assignedPRs: team.assignedPRs
          .slice()
          .sort(
            (a, b) =>
              new Date(a.assignedAt).getTime() -
              new Date(b.assignedAt).getTime(),
          ),
        members: team.members.map((member) => ({
          ...member,
          assignedPRs: member.assignedPRs
            .slice()
            .sort(
              (a, b) =>
                new Date(a.assignedAt).getTime() -
                new Date(b.assignedAt).getTime(),
            ),
        })),
      })),
  };

  return NextResponse.json(sorted);
}
