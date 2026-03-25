import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  fetchUnansweredIssues,
  GitHubGraphQLError,
} from "@/lib/github/github.fetcher";
import { formatIssues } from "@/lib/github/github-issues.mapper";
import { CONSTANTS } from "@/lib/constants";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const platform = session.user.platform ?? "WEB";
    const repoTarget =
      CONSTANTS.GITHUB_REPOS[platform as keyof typeof CONSTANTS.GITHUB_REPOS] ??
      CONSTANTS.GITHUB_REPOS.WEB;

    const issuesData = await fetchUnansweredIssues(repoTarget);
    return NextResponse.json({
      issues: formatIssues(issuesData),
    });
  } catch (error) {
    console.error(error);

    if (error instanceof GitHubGraphQLError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch GitHub issues" },
      { status: 500 },
    );
  }
}
