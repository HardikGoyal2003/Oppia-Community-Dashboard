import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { upsertTriagePrediction } from "@/db/issue-triage/issue-triage.db";
import type { AIPrediction } from "@/lib/issue-triage/issue-triage.types";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";
const TRIAGE_API_KEY = process.env.TRIAGE_API_KEY || "";

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

/**
 * Server-side proxy to trigger AI triage for a single issue.
 * Keeps the Python backend URL and API key off the client.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  const { role } = session.user;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      issueNumber: number;
      issueTitle: string;
      issueUrl: string;
      issueBody?: string;
      labels?: string[];
    };

    if (
      typeof body.issueNumber !== "number" ||
      !body.issueTitle ||
      !body.issueUrl
    ) {
      return NextResponse.json(
        { error: "Missing required fields: issueNumber, issueTitle, issueUrl" },
        { status: 400 },
      );
    }

    const backendRes = await fetch(`${TRIAGE_BACKEND}/triage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(TRIAGE_API_KEY ? { "X-API-Key": TRIAGE_API_KEY } : {}),
      },
      body: JSON.stringify({
        issue: {
          issueNumber: body.issueNumber,
          issueTitle: body.issueTitle,
          issueUrl: body.issueUrl,
          issueBody: body.issueBody || "",
          labels: body.labels || [],
        },
      }),
      signal: AbortSignal.timeout(150000),
    });

    if (!backendRes.ok) {
      return NextResponse.json(
        { error: `AI triage backend returned ${backendRes.status}` },
        { status: 502 },
      );
    }

    const prediction: TriageBackendResponse = await backendRes.json();
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

    const id = await upsertTriagePrediction(
      body.issueNumber,
      body.issueTitle,
      body.issueUrl,
      aiPrediction,
      body.labels || [],
    );

    return NextResponse.json({ id, prediction: aiPrediction });
  } catch (error) {
    console.error("Trigger triage error:", error);
    return NextResponse.json(
      { error: "Failed to trigger triage" },
      { status: 500 },
    );
  }
}
