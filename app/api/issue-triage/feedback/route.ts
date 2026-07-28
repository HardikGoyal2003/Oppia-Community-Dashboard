import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  storeTriageFeedback,
  getTriageFeedbackByIssue,
} from "@/db/issue-triage/issue-triage.db";
import type { TriageCorrection } from "@/lib/issue-triage/issue-triage.types";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const issueNumber = searchParams.get("issueNumber");

  if (!issueNumber) {
    return NextResponse.json({ error: "Missing issueNumber" }, { status: 400 });
  }

  const feedback = await getTriageFeedbackByIssue(Number(issueNumber));
  return NextResponse.json({ feedback });
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
      issueNumber: number;
      issueId: string;
      predictionAccuracy: number;
      reviewStatus: "accepted" | "edited" | "rejected";
      changes: TriageCorrection[];
      reviewerNotes?: string;
    };

    const id = await storeTriageFeedback(
      body.issueNumber,
      body.issueId,
      body.predictionAccuracy,
      body.reviewStatus,
      session.user.githubUsername || "unknown",
      body.changes,
      body.reviewerNotes,
    );

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Triage feedback API error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
