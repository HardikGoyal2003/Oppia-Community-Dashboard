import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { sendWeeklyActionItemDigest } from "@/lib/notifications/action-item-digest.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

/**
 * Sends the weekly action-items digest to team leads. Idempotent per week;
 * pass `?force=true` (still requiring CRON_SECRET) to re-send intentionally.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(req.url).searchParams.get("force") === "true";

  try {
    const summary = await sendWeeklyActionItemDigest({ force });
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send the action items digest.",
      },
      { status: 500 },
    );
  }
}
