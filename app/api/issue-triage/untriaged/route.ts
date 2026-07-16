import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { requestGitHubRest } from "@/lib/github/github.rest";
import { getAllTriageIssues } from "@/db/issue-triage/issue-triage.db";

interface GitHubSearchIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
  body: string | null;
  user: { login: string } | null;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubSearchIssue[];
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const perPage = parseInt(searchParams.get("per_page") || "20", 10);

    const githubResponse = await requestGitHubRest<GitHubSearchResponse>(
      `/search/issues?q=repo:oppia/oppia+state:open+type:issue+label:"triage+needed"&per_page=${perPage}&page=${page}&sort=created&order=desc`,
    );

    const triagedIssues = await getAllTriageIssues();
    const triagedNumbers = new Set(triagedIssues.map((i) => i.issueNumber));

    const untriaged = githubResponse.items
      .filter((issue) => !triagedNumbers.has(issue.number))
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
        labels: issue.labels.map((l) => l.name),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        body: issue.body || "",
        author: issue.user?.login || "unknown",
      }));

    return NextResponse.json({
      issues: untriaged,
      totalGitHub: githubResponse.total_count,
      totalTriaged: triagedNumbers.size,
      page,
      perPage,
    });
  } catch (error) {
    console.error("Failed to fetch untriaged issues:", error);
    return NextResponse.json(
      { error: "Failed to fetch GitHub issues" },
      { status: 500 },
    );
  }
}
