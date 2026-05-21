import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getTeamReportForAssignment } from "@/lib/team-reports/team-reports.service";

function canViewOwnTeamReport(role: string): boolean {
  return role === "TEAM_LEAD" || role === "LEAD_TRAINEE";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !canViewOwnTeamReport(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!session.user.team || !session.user.platform) {
    return NextResponse.json(
      { error: "Your team assignment is incomplete." },
      { status: 400 },
    );
  }

  const report = await getTeamReportForAssignment(
    session.user.team,
    session.user.platform,
  );

  if (!report) {
    return NextResponse.json(
      { error: "No team report found for your assignment." },
      { status: 404 },
    );
  }

  return NextResponse.json({ report });
}
