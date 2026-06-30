import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { syncPendingReviews } from "@/lib/team-activity/sync-pending-reviews.service";

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
    const summary = await syncPendingReviews();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync pending reviews.",
      },
      { status: 500 },
    );
  }
}
