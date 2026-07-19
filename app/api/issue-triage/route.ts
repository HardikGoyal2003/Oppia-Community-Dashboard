import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { requestGitHubRest } from "@/lib/github/github.rest";
import {
  getPendingTriageIssues,
  getAllTriageIssues,
  getTriageIssuesByStatus,
  getTriageStats,
  upsertTriagePrediction,
  acceptTriagePrediction,
  editTriagePrediction,
  rejectTriagePrediction,
  getTriageIssueByIssueNumber,
  storeTriageFeedback,
} from "@/db/issue-triage/issue-triage.db";
import type {
  AIPrediction,
  TriageCorrection,
  TriageReviewStatus,
} from "@/lib/issue-triage/issue-triage.types";

const TRIAGE_BACKEND =
  process.env.TRIAGE_BACKEND_URL || "http://localhost:8000";
const TRIAGE_API_KEY = process.env.TRIAGE_API_KEY || "";

const VALID_STATUSES: TriageReviewStatus[] = [
  "pending",
  "accepted",
  "edited",
  "rejected",
];

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
  } catch (error) {
    console.error(`Failed to apply labels to ${repo}#${issueNumber}:`, error);
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
  } catch (error) {
    // A 404 here usually means the label wasn't on the issue — acceptable.
    console.warn(
      `Could not remove label "${labelName}" from ${repo}#${issueNumber}:`,
      error,
    );
    return false;
  }
}

async function sendFeedbackToBackend(
  issueNumber: number,
  issueId: string,
  reviewStatus: string,
  corrections: TriageCorrection[],
  predictionAccuracy: number,
  reviewer: string,
  reviewerNotes?: string,
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
      headers: {
        "Content-Type": "application/json",
        ...(TRIAGE_API_KEY ? { "X-API-Key": TRIAGE_API_KEY } : {}),
      },
      body: JSON.stringify({
        issueNumber,
        issueId,
        predictionAccuracy,
        reviewStatus,
        reviewer,
        changes: corrections,
        reviewerNotes: reviewerNotes || "",
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
    if (!VALID_STATUSES.includes(status as TriageReviewStatus)) {
      return NextResponse.json(
        { error: `Invalid status: ${status}` },
        { status: 400 },
      );
    }
    const issues =
      status === "pending"
        ? await getPendingTriageIssues()
        : await getTriageIssuesByStatus(status as TriageReviewStatus);
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

  const reviewer = session.user.githubUsername || "unknown";

  try {
    const body = (await req.json()) as {
      action: "create" | "accept" | "edit" | "reject";
      issueNumber: number;
      issueTitle?: string;
      issueUrl?: string;
      prediction?: AIPrediction;
      corrections?: TriageCorrection[];
      reviewerNotes?: string;
      createdAt?: string;
    };

    const { action, issueNumber } = body;
    if (typeof issueNumber !== "number" || !Number.isInteger(issueNumber)) {
      return NextResponse.json(
        { error: "issueNumber must be an integer" },
        { status: 400 },
      );
    }

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
        // Status guard: prevent double review (two admins racing).
        if (existing.status !== "pending") {
          return NextResponse.json(
            { error: `Issue already reviewed (status: ${existing.status})` },
            { status: 409 },
          );
        }

        // Apply labels on GitHub FIRST — only mark accepted if it worked.
        const repo = extractRepoFromIssueUrl(existing.issueUrl);
        const labelsToAdd = existing.prediction.newLabels?.length
          ? existing.prediction.newLabels
          : existing.prediction.labels.filter((l) => l !== "triage needed");

        let labelsApplied = true;
        if (labelsToAdd.length > 0) {
          labelsApplied = await applyLabelsOnGitHub(
            issueNumber,
            repo,
            labelsToAdd,
          );
        }
        if (!labelsApplied) {
          return NextResponse.json(
            {
              error:
                "Failed to apply labels on GitHub. The prediction was NOT marked as accepted — please retry.",
            },
            { status: 502 },
          );
        }
        const triageLabelRemoved = await removeLabelOnGitHub(
          issueNumber,
          repo,
          "triage needed",
        );

        await acceptTriagePrediction(existing.id, reviewer);

        // Store feedback doc + notify Python backend (learning loop)
        await storeTriageFeedback(
          issueNumber,
          existing.id,
          100,
          "accepted",
          reviewer,
          [],
          body.reviewerNotes,
        );
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "accepted",
          [],
          100,
          reviewer,
          body.reviewerNotes,
        );

        return NextResponse.json({
          success: true,
          labelsApplied: labelsToAdd,
          triageLabelRemoved,
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
        if (existing.status !== "pending") {
          return NextResponse.json(
            { error: `Issue already reviewed (status: ${existing.status})` },
            { status: 409 },
          );
        }
        const corrections = body.corrections || [];

        // Determine final labels after corrections
        let finalLabels = [...existing.prediction.labels];
        const labelsCorrection = corrections.find((c) => c.field === "labels");
        if (labelsCorrection) {
          finalLabels = labelsCorrection.corrected as string[];
        }
        // Remove "triage needed" from final labels
        finalLabels = finalLabels.filter((l) => l !== "triage needed");

        // Apply corrected labels on GitHub FIRST — only persist if it worked.
        const editRepo = extractRepoFromIssueUrl(existing.issueUrl);
        let labelsApplied = true;
        if (finalLabels.length > 0) {
          labelsApplied = await applyLabelsOnGitHub(
            issueNumber,
            editRepo,
            finalLabels,
          );
        }
        if (!labelsApplied) {
          return NextResponse.json(
            {
              error:
                "Failed to apply labels on GitHub. The edit was NOT saved — please retry.",
            },
            { status: 502 },
          );
        }
        const triageLabelRemoved = await removeLabelOnGitHub(
          issueNumber,
          editRepo,
          "triage needed",
        );

        await editTriagePrediction(existing.id, reviewer, corrections);

        // Calculate prediction accuracy based on corrections
        const totalFields = 7; // labels, team, repo, cuj, gfi, priority, severity
        const correctedFields = Math.min(corrections.length, totalFields);
        const accuracy = Math.round(
          ((totalFields - correctedFields) / totalFields) * 100,
        );

        // Store feedback doc + notify Python backend (learning loop)
        await storeTriageFeedback(
          issueNumber,
          existing.id,
          accuracy,
          "edited",
          reviewer,
          corrections,
          body.reviewerNotes,
        );
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "edited",
          corrections,
          accuracy,
          reviewer,
          body.reviewerNotes,
        );

        return NextResponse.json({
          success: true,
          labelsApplied: finalLabels,
          triageLabelRemoved,
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
        if (existing.status !== "pending") {
          return NextResponse.json(
            { error: `Issue already reviewed (status: ${existing.status})` },
            { status: 409 },
          );
        }
        const corrections = body.corrections || [];
        await rejectTriagePrediction(existing.id, reviewer, corrections);

        // Store feedback doc + notify Python backend (learning loop)
        await storeTriageFeedback(
          issueNumber,
          existing.id,
          0,
          "rejected",
          reviewer,
          corrections,
          body.reviewerNotes,
        );
        await sendFeedbackToBackend(
          issueNumber,
          existing.id,
          "rejected",
          corrections,
          0,
          reviewer,
          body.reviewerNotes,
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
