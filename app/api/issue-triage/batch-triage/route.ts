import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { requestGitHubRest } from "@/lib/github/github.rest";
import {
  getAllTriageIssues,
  upsertTriagePrediction,
} from "@/db/issue-triage/issue-triage.db";
import type { AIPrediction } from "@/lib/issue-triage/issue-triage.types";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";
const TRIAGE_API_KEY = process.env.TRIAGE_API_KEY || "";

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

interface BackendTriageResult {
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
  existingLabels: string[];
}

async function fetchAllOpenIssues(): Promise<GitHubSearchIssue[]> {
  const allIssues: GitHubSearchIssue[] = [];
  let page = 1;

  while (true) {
    const githubResponse = await requestGitHubRest<GitHubSearchResponse>(
      `/search/issues?q=repo:oppia/oppia+state:open+type:issue+label:"triage+needed"&per_page=100&page=${page}&sort=created&order=desc`,
    );

    allIssues.push(...githubResponse.items);

    if (githubResponse.items.length < 100) break;
    page++;

    if (page > 10) break;
  }

  return allIssues;
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  // Batch triage is expensive (long-running backend job) — admins only.
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const allIssues = await fetchAllOpenIssues();

    const triagedIssues = await getAllTriageIssues();
    const triagedNumbers = new Set(triagedIssues.map((i) => i.issueNumber));

    const untriaged = allIssues.filter(
      (issue) => !triagedNumbers.has(issue.number),
    );

    if (untriaged.length === 0) {
      return NextResponse.json({
        message: "All issues already triaged",
        triaged: 0,
        failed: 0,
        total: allIssues.length,
        untriaged: 0,
      });
    }

    // Send all untriaged issues to Python backend in one batch
    const backendPayload = {
      issues: untriaged.map((issue) => ({
        issueNumber: issue.number,
        issueTitle: issue.title,
        issueUrl: issue.html_url,
        issueBody: issue.body || "",
        existingLabels: issue.labels.map((l) => l.name),
      })),
    };

    const backendRes = await fetch(`${TRIAGE_BACKEND}/batch-triage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TRIAGE_API_KEY ? { "X-API-Key": TRIAGE_API_KEY } : {}),
      },
      body: JSON.stringify(backendPayload),
      signal: AbortSignal.timeout(600000), // 10 min timeout
    });

    if (!backendRes.ok) {
      throw new Error(`Python backend returned ${backendRes.status}`);
    }

    const backendData = await backendRes.json();
    const results: BackendTriageResult[] = backendData.results || [];

    // Store all results in Firestore
    let stored = 0;
    for (const result of results) {
      const issue = untriaged.find((i) => i.number === result.issueNumber);
      if (!issue) continue;

      const aiPrediction: AIPrediction = {
        labels: result.labels,
        newLabels: result.newLabels || [],
        team: result.team,
        repository: result.repository,
        cuj: result.cuj,
        goodFirstIssue: result.goodFirstIssue,
        priority: result.priority,
        severity: result.severity,
        confidenceScore: result.confidenceScore,
        explanation: result.explanation,
        similarIssues: result.similarIssues,
      };

      await upsertTriagePrediction(
        issue.number,
        issue.title,
        issue.html_url,
        aiPrediction,
        result.existingLabels || issue.labels.map((l) => l.name),
        issue.created_at,
      );
      stored++;
    }

    return NextResponse.json({
      message: `Triaged ${stored} issues (${results.length} total processed)`,
      triaged: stored,
      failed: untriaged.length - stored,
      total: allIssues.length,
      untriaged: untriaged.length,
    });
  } catch (error) {
    console.error("Batch triage error:", error);
    return NextResponse.json({ error: "Batch triage failed" }, { status: 500 });
  }
}
