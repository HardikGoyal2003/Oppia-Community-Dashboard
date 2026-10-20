import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { syncActionItems } from "@/lib/action-items/action-items.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

/**
 * Reconciles tracked action items with the current team reports. Runs daily so
 * items are created, refreshed, reopened, and auto-resolved even when nobody
 * opens the dashboard.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncActionItems();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync action items.",
      },
      { status: 500 },
    );
  }
}
