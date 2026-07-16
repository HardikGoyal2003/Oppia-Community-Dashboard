import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { requestGitHubRest } from "@/lib/github/github.rest";
import {
  getPendingTriageIssues,
  getAllTriageIssues,
  getTriageStats,
  upsertTriagePrediction,
  acceptTriagePrediction,
  editTriagePrediction,
  rejectTriagePrediction,
  getTriageIssueByIssueNumber,
} from "@/db/issue-triage/issue-triage.db";
import type {
  AIPrediction,
  TriageCorrection,
} from "@/lib/issue-triage/issue-triage.types";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";

function extractRepoFromIssueUrl(url: string): string {
  // https://github.com/oppia/oppia/issues/12345 → oppia/oppia
  const match = url.match(/github\.com\/([^/]+\/[^/]+)\/issues/);
  return match ? match[1] : "oppia/oppia";
}

async function applyLabelsOnGitHub(
  issueNumber: number,
  repo: string,
  labelsToAdd: string[],
): Promise<boolean> {
  try {
    await requestGitHubRest(`/repos/${repo}/issues/${issueNumber}/labels`, {
      method: "POST",
      body: JSON.stringify({ labels: labelsToAdd }),
    });
    return true;
  } catch {
    return false;
  }
}

async function removeLabelOnGitHub(
  issueNumber: number,
  repo: string,
  labelName: string,
): Promise<boolean> {
  try {
    await requestGitHubRest(
      `/repos/${repo}/issues/${issueNumber}/labels/${encodeURIComponent(labelName)}`,
      { method: "DELETE" },
    );
    return true;
  } catch {
    // Label might not exist on the issue — that's fine
    return false;
  }
}

async function sendFeedbackToBackend(
  issueNumber: number,
  issueId: string,
  reviewStatus: string,
  corrections: TriageCorrection[],
  predictionAccuracy: number,
) {
  try {
    // Extract corrected labels and team from corrections for the learning loop
    const correctedLabels = corrections
      .filter((c) => c.field === "labels")
      .map((c) => c.corrected)
      .flat() as string[] | undefined;
    const correctedTeam = corrections.find((c) => c.field === "team")
      ?.corrected as string | undefined;

    await fetch(`${TRIAGE_BACKEND}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        issueNumber,
        issueId,
        predictionAccuracy,
        reviewStatus,
        reviewer: "system",
        changes: corrections,
        correctedLabels:
          correctedLabels && correctedLabels.length > 0
            ? correctedLabels
            : undefined,
        correctedTeam,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Feedback to backend is best-effort — don't fail the main request
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const stats = searchParams.get("stats");

  if (stats === "true") {
    const triageStats = await getTriageStats();
    return NextResponse.json({ stats: triageStats });
  }

  if (status && status !== "all") {
    const issues = await getPendingTriageIssues();
    return NextResponse.json({ issues });
  }

  const issues = await getAllTriageIssues();
  return NextResponse.json({ issues });
}

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
      action: "create" | "accept" | "edit" | "reject";
      issueNumber: number;
      issueTitle?: string;
      issueUrl?: string;
      prediction?: AIPrediction;
      corrections?: TriageCorrection[];
      createdAt?: string;
    };

    const { action, issueNumber } = body;

    switch (action) {
      case "create": {
        if (!body.prediction || !body.issueTitle || !body.issueUrl) {
          return NextResponse.json(
            {
              error:
                "Missing required fields: prediction, issueTitle, issueUrl",
            },
            { status: 400 },
          );
        }
        const id = await upsertTriagePrediction(
          issueNumber,
          body.issueTitle,
          body.issueUrl,
          body.prediction,
          [],
          body.createdAt,
        );
        return NextResponse.json({ id });
      }

      case "accept": {
        const existing = await getTriageIssueByIssueNumber(issueNumber);
        if (!existing) {
          return NextResponse.json(
            { error: "Issue not found" },
            { status: 404 },
          );
        }
        await acceptTriagePrediction(
          existing.id,
          session.user.githubUsername || "unknown",
        );

        // Apply labels on GitHub: add predicted new labels, remove "triage needed"
        const repo = extractRepoFromIssueUrl(existing.issueUrl);
        const labelsToAdd = existing.prediction.newLabels?.length
          ? existing.prediction.newLabels
          : existing.prediction.labels.filter((l) => l !== "triage needed");

        // Apply new labels to GitHub issue
        if (labelsToAdd.length > 0) {
          await applyLabelsOnGitHub(issueNumber, repo, labelsToAdd);
        }
        // Remove "triage needed" label from GitHub issue
        await removeLabelOnGitHub(issueNumber, repo, "triage needed");

        // Send feedback to Python backend for learning loop (best-effort)
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "accept",
          [],
          100,
        );

        return NextResponse.json({
          success: true,
          labelsApplied: labelsToAdd,
          triageLabelRemoved: true,
        });
      }

      case "edit": {
        const existing = await getTriageIssueByIssueNumber(issueNumber);
        if (!existing) {
          return NextResponse.json(
            { error: "Issue not found" },
            { status: 404 },
          );
        }
        const corrections = body.corrections || [];
        await editTriagePrediction(
          existing.id,
          session.user.githubUsername || "unknown",
          corrections,
        );

        // Determine final labels after corrections
        let finalLabels = [...existing.prediction.labels];
        const labelsCorrection = corrections.find((c) => c.field === "labels");
        if (labelsCorrection) {
          finalLabels = labelsCorrection.corrected as string[];
        }
        // Remove "triage needed" from final labels
        finalLabels = finalLabels.filter((l) => l !== "triage needed");

        // Apply corrected labels on GitHub
        const editRepo = extractRepoFromIssueUrl(existing.issueUrl);
        if (finalLabels.length > 0) {
          await applyLabelsOnGitHub(issueNumber, editRepo, finalLabels);
        }
        // Remove "triage needed" label from GitHub issue
        await removeLabelOnGitHub(issueNumber, editRepo, "triage needed");

        // Calculate prediction accuracy based on corrections
        const totalFields = 7; // labels, team, repo, cuj, gfi, priority, severity
        const correctedFields = corrections.length;
        const accuracy = Math.round(
          ((totalFields - correctedFields) / totalFields) * 100,
        );

        // Send feedback to Python backend for learning loop (best-effort)
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "edit",
          corrections,
          accuracy,
        );

        return NextResponse.json({
          success: true,
          labelsApplied: finalLabels,
          triageLabelRemoved: true,
        });
      }

      case "reject": {
        const existing = await getTriageIssueByIssueNumber(issueNumber);
        if (!existing) {
          return NextResponse.json(
            { error: "Issue not found" },
            { status: 404 },
          );
        }
        const corrections = body.corrections || [];
        await rejectTriagePrediction(
          existing.id,
          session.user.githubUsername || "unknown",
          corrections,
        );

        // Send feedback to Python backend for learning loop (best-effort)
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "reject",
          corrections,
          0,
        );

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Issue triage API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
