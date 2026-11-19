import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  ReviewerTeamsDataNotFoundError,
  getReviewerTeamsDashboard,
} from "@/lib/reviewer-teams/reviewer-teams-dashboard.service";

function canViewReviewerTeams(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewReviewerTeams(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    return NextResponse.json(await getReviewerTeamsDashboard());
  } catch (error) {
    if (error instanceof ReviewerTeamsDataNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    throw error;
  }
}
