import { NextResponse } from "next/server";
import { ReviewAnalyticsLockBusyError } from "@/db/review-analytics-lock/review-analytics-lock.db";
import { readEnv } from "@/lib/config";
import { syncReviewCycles } from "@/lib/team-activity/sync-review-cycles.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");
  if (!cronSecret) return false;
  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncReviewCycles();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof ReviewAnalyticsLockBusyError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync review cycles.",
      },
      { status: 500 },
    );
  }
}
