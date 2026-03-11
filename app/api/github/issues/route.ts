import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { main } from "@/lib/github/github.fetcher";
import { formatIssues } from "@/lib/utils/ format-issues.utils";
import { CONSTANTS } from "@/lib/constants";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const platform = session.user.platform ?? "WEB";
    const repoTarget =
      CONSTANTS.GITHUB_REPOS_BY_PLATFORM[
        platform as keyof typeof CONSTANTS.GITHUB_REPOS_BY_PLATFORM
      ] ?? CONSTANTS.GITHUB_REPOS_BY_PLATFORM.WEB;

    const issuesData = await main(repoTarget);
    return NextResponse.json({
      issues: formatIssues(issuesData),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub issues" },
      { status: 500 }
    );
  }
}
