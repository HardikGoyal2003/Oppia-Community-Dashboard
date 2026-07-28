import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { GITHUB_REPOS } from "@/lib/config";
import { requestGitHubRest } from "@/lib/github/github.rest";
import { upsertTriagePrediction } from "@/db/issue-triage/issue-triage.db";
import type { AIPrediction } from "@/lib/issue-triage/issue-triage.types";
import type { GitHubRepoTarget } from "@/lib/github/github.types";

interface GitHubIssueItem {
  number: number;
  title: string;
  html_url: string;
  state: string;
  created_at: string;
  labels: { name: string }[];
  body: string | null;
}

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

function generateMockPrediction(issue: GitHubIssueItem): AIPrediction {
  const title = issue.title.toLowerCase();
  const body = (issue.body || "").toLowerCase();

  const isBug =
    title.includes("bug") ||
    title.includes("crash") ||
    title.includes("error") ||
    title.includes("broken") ||
    title.includes("fail") ||
    body.includes("bug") ||
    body.includes("unexpected behavior");

  const labels = issue.labels.map((l) => l.name);
  if (isBug && !labels.includes("bug")) {
    labels.unshift("bug");
  }

  const isTranslation =
    title.includes("translation") ||
    title.includes("i18n") ||
    title.includes("locale") ||
    title.includes("language");

  const isPerformance =
    title.includes("performance") ||
    title.includes("slow") ||
    title.includes("lag");

  const isDocs =
    title.includes("doc") || title.includes("readme") || title.includes("typo");

  if (isTranslation) labels.push("translation");
  if (isPerformance) labels.push("performance");
  if (isDocs) labels.push("documentation");

  let team = "Engineering";
  if (isTranslation) team = "Community";
  if (isDocs) team = "Docs";
  if (title.includes("design") || title.includes("ui") || title.includes("ux"))
    team = "Design";

  const repository = "oppia/oppia";

  let cuj = "Learner Experience";
  if (isTranslation) cuj = "Translation Review";
  if (team === "Docs") cuj = "Community Management";
  if (title.includes("admin") || title.includes("dashboard"))
    cuj = "Infrastructure";

  const goodFirstIssue =
    labels.includes("good first issue") || (isBug && !isTranslation);

  let priority = "medium";
  if (isBug) priority = "high";
  if (isPerformance) priority = "high";
  if (isDocs) priority = "low";

  let severity = "minor";
  if (isBug && !isDocs) severity = "major";
  if (isPerformance) severity = "major";
  if (title.includes("crash") || title.includes("security"))
    severity = "blocker";

  const confidenceScore = Math.floor(Math.random() * 20) + 75;

  let explanation = `This issue matches the pattern of ${isBug ? "bug reports" : "feature requests"} in the ${team} team. `;
  if (isTranslation)
    explanation +=
      "The translation-related keywords suggest it affects the Translation Review CUJ. ";
  if (isPerformance)
    explanation +=
      "Performance-related keywords indicate this is an infrastructure concern. ";
  explanation += `Based on semantic similarity with previously triaged issues, confidence is ${confidenceScore}%.`;

  const similarIssues = [
    { number: issue.number - 1, title: "Related historical issue", score: 87 },
    { number: issue.number - 2, title: "Similar pattern detected", score: 72 },
  ];

  return {
    labels: [...new Set(labels)],
    newLabels: [...new Set(labels)],
    team,
    repository,
    cuj,
    goodFirstIssue,
    priority,
    severity,
    confidenceScore,
    explanation,
    similarIssues,
  };
}

export async function POST() {
  if (!isDevelopmentMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const repoTarget: GitHubRepoTarget = GITHUB_REPOS.WEB;
    const issues = await requestGitHubRest<{ items: GitHubIssueItem[] }>(
      `/search/issues?q=repo:${repoTarget.owner}/${repoTarget.repo}+state:open+type:issue&per_page=10&sort=created&order=desc`,
    );

    let seeded = 0;

    for (const issue of issues.items) {
      if (issue.state !== "open") continue;

      const prediction = generateMockPrediction(issue);
      await upsertTriagePrediction(
        issue.number,
        issue.title,
        issue.html_url,
        prediction,
      );
      seeded++;
    }

    return NextResponse.json({
      message: `Seeded ${seeded} triage predictions from recent GitHub issues.`,
      seeded,
    });
  } catch (error) {
    console.error("Seed triage error:", error);
    return NextResponse.json(
      { error: "Failed to seed triage data. Make sure GITHUB_TOKEN is set." },
      { status: 500 },
    );
  }
}
