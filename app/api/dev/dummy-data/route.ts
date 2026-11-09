import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { generateTeamReportsDummyData } from "@/lib/dev/generate-team-reports-dummy-data.service";
import { generateDiscussionMetricsDummyData } from "@/lib/dev/generate-discussion-metrics-dummy-data.service";
import { generateReviewerTeamsDummyData } from "@/lib/dev/generate-reviewer-teams-dummy-data.service";

type DummyDataRequestBody = {
  generatorKey?: string;
};

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

function isSuperAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export async function POST(req: Request) {
  if (!isDevelopmentMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as DummyDataRequestBody;
  const generatorKey =
    typeof body.generatorKey === "string" ? body.generatorKey.trim() : "";

  try {
    if (generatorKey === "team_reports") {
      const summary = await generateTeamReportsDummyData();

      return NextResponse.json({
        summary: [
          "Dummy data generated successfully.",
          `Teams written: ${summary.teamsWritten}.`,
          `Daily team metric snapshots written: ${summary.metricsWritten}.`,
        ].join("\n"),
      });
    }

    if (generatorKey === "discussions") {
      const summary = await generateDiscussionMetricsDummyData();

      return NextResponse.json({
        summary: [
          "Dummy data generated successfully.",
          `Daily discussion metric snapshots written: ${summary.discussionMetricsWritten}.`,
        ].join("\n"),
      });
    }

    if (generatorKey === "reviewers") {
      const summary = await generateReviewerTeamsDummyData();

      return NextResponse.json({
        summary: [
          "Dummy data generated successfully.",
          `Reviewer teams written: ${summary.teamsWritten}.`,
          `Reviewer documents written: ${summary.reviewersWritten}.`,
          `Pending PRs written: ${summary.pendingReviewsWritten}.`,
        ].join("\n"),
      });
    }

    return NextResponse.json(
      { error: "Unsupported dummy data generator." },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate dummy data.",
      },
      { status: 500 },
    );
  }
}
