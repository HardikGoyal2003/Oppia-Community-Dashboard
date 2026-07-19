import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { requestGitHubRest } from "@/lib/github/github.rest";
import {
  getAllTriageIssues,
  upsertTriagePrediction,
} from "@/db/issue-triage/issue-triage.db";
import type { AIPrediction } from "@/lib/issue-triage/issue-triage.types";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";
const TRIAGE_API_KEY = process.env.TRIAGE_API_KEY || "";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");
  if (!cronSecret) return false;
  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

interface GitHubSearchIssue {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: { name: string; color: string }[];
  body: string | null;
  created_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  items: GitHubSearchIssue[];
}

interface TriageBackendResponse {
  issueNumber: number;
  labels: string[];
  newLabels: string[];
  team: string;
  repository: string;
  cuj: string;
  goodFirstIssue: boolean;
  priority: string;
  severity: string;
  confidenceScore: number;
  explanation: string;
  similarIssues: { number: number; title: string; score: number }[];
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  let triaged = 0;
  let failed = 0;
  let totalOpen = 0;

  try {
    // 1. Fetch ALL open issues with "triage needed" label from GitHub (paginated, max 1000)
    const allIssues: GitHubSearchIssue[] = [];
    let page = 1;
    while (page <= 10) {
      const res = await requestGitHubRest<GitHubSearchResponse>(
        `/search/issues?q=repo:oppia/oppia+state:open+type:issue+label:"triage+needed"&per_page=100&page=${page}&sort=created&order=desc`,
      );
      allIssues.push(...res.items);
      if (res.items.length < 100) break;
      page++;
    }
    totalOpen = allIssues.length;

    // 2. Filter to only untriaged issues
    const triagedIssues = await getAllTriageIssues();
    const triagedNumbers = new Set(triagedIssues.map((i) => i.issueNumber));
    const untriaged = allIssues.filter(
      (issue) => !triagedNumbers.has(issue.number),
    );

    if (untriaged.length === 0) {
      return NextResponse.json({
        status: "success",
        message: "All issues already triaged",
        totalOpen,
        untriaged: 0,
        triaged: 0,
        failed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    // 3. Triage untriaged issues in batches of 3
    const BATCH_SIZE = 3;
    for (let i = 0; i < untriaged.length; i += BATCH_SIZE) {
      const batch = untriaged.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (issue) => {
          const res = await fetch(`${TRIAGE_BACKEND}/triage`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(TRIAGE_API_KEY ? { "X-API-Key": TRIAGE_API_KEY } : {}),
            },
            body: JSON.stringify({
              issue: {
                issueNumber: issue.number,
                issueTitle: issue.title,
                issueUrl: issue.html_url,
                issueBody: issue.body || "",
                labels: issue.labels.map((l) => l.name),
              },
            }),
            signal: AbortSignal.timeout(120000),
          });

          if (!res.ok) throw new Error(`Triage failed for #${issue.number}`);

          const prediction: TriageBackendResponse = await res.json();
          const aiPrediction: AIPrediction = {
            labels: prediction.labels,
            newLabels: prediction.newLabels || [],
            team: prediction.team,
            repository: prediction.repository,
            cuj: prediction.cuj,
            goodFirstIssue: prediction.goodFirstIssue,
            priority: prediction.priority,
            severity: prediction.severity,
            confidenceScore: prediction.confidenceScore,
            explanation: prediction.explanation,
            similarIssues: prediction.similarIssues,
          };

          await upsertTriagePrediction(
            issue.number,
            issue.title,
            issue.html_url,
            aiPrediction,
            issue.labels.map((l) => l.name),
            issue.created_at,
          );
        }),
      );

      triaged += results.filter((r) => r.status === "fulfilled").length;
      failed += results.filter((r) => r.status === "rejected").length;
    }

    return NextResponse.json({
      status: "success",
      message: `Daily triage complete: ${triaged} triaged, ${failed} failed`,
      totalOpen,
      untriaged: untriaged.length,
      triaged,
      failed,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("Daily issue triage cron error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
        triaged,
        failed,
        totalOpen,
        durationMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
