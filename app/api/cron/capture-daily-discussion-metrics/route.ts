import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { captureDailyDiscussionMetrics } from "@/lib/discussion-metrics/capture-daily-discussion-metrics.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await captureDailyDiscussionMetrics();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to capture unanswered discussion metrics.",
      },
      { status: 500 },
    );
  }
}
