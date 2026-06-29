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
      { error: "No reviewer teams data found. Run the Sync Reviewer Teams cron job first." },
      { status: 404 },
    );
  }

  return NextResponse.json(document);
}
