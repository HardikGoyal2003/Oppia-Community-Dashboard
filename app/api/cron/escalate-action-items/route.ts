import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config";
import { escalateDueActionItems } from "@/lib/action-items/escalation.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

/**
 * Escalates action items that crossed their idle boundary, nudging each
 * team's leads. Runs daily but only sends when an item is actually due, so
 * leads are never spammed; delivery is idempotent per (day, team, channel).
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await escalateDueActionItems();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to escalate action items.",
      },
      { status: 500 },
    );
  }
}
