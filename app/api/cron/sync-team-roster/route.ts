import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config/server";
import { syncTeamRoster } from "@/lib/team-roster/sync-team-roster.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

/**
 * Reconciles the public team roster sheets with registered dashboard users.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncTeamRoster();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync team rosters.",
      },
      { status: 500 },
    );
  }
}
