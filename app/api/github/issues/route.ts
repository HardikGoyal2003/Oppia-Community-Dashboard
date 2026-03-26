import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { GITHUB_REPOS } from "@/lib/config";
import {
  fetchUnansweredIssues,
  GitHubGraphQLError,
} from "@/lib/github/github.fetcher";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const platform = session.user.platform;

    if (!platform) {
      return NextResponse.json(
        { error: "No contribution platform found for the current user." },
        { status: 400 },
      );
    }

    const repoTarget = GITHUB_REPOS[platform];

    if (!repoTarget) {
      return NextResponse.json(
        { error: `No GitHub repo configured for platform: ${platform}` },
        { status: 500 },
      );
    }

    const issuesData = await fetchUnansweredIssues(repoTarget);
    return NextResponse.json({
      issues: issuesData,
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
