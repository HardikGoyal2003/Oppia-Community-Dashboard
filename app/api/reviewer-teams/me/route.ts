import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { getMyReviewerReport } from "@/lib/reviewer-teams/reviewer-teams-dashboard.service";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const githubUsername = session.user.githubUsername.trim();

  if (!githubUsername) {
    return NextResponse.json(
      { error: "Your GitHub username is unavailable. Please sign in again." },
      { status: 400 },
    );
  }

  const report = await getMyReviewerReport(githubUsername);

  return NextResponse.json({ report });
}
