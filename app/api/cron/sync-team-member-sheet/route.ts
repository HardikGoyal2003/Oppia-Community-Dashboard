import { NextResponse } from "next/server";
import { readEnv } from "@/lib/config/server";
import { syncTeamMemberSheet } from "@/lib/team-member-sheet/sync-team-member-sheet.service";

function isAuthorizedCronRequest(req: Request): boolean {
  const cronSecret = readEnv("CRON_SECRET");

  if (!cronSecret) {
    return false;
  }

  const authorization = req.headers.get("authorization");
  return authorization === `Bearer ${cronSecret}`;
}

/**
 * Reconciles the public team member sheets with registered dashboard users.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await syncTeamMemberSheet();
    return NextResponse.json(summary);
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync team member sheets.",
      },
      { status: 500 },
    );
  }
}
