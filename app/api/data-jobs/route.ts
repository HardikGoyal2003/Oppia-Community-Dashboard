import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { DbNotFoundError } from "@/db/db.errors";
import { getUserById } from "@/db/users/users.db";
import {
  listAvailableDataJobs,
  listRecentDataJobRuns,
  runDataJob,
} from "@/lib/data-jobs/data-jobs.service";

type DataJobRunRequestBody = {
  dryRun?: boolean;
  jobKey?: string;
};

function isSuperAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const [jobs, runs] = await Promise.all([
    listAvailableDataJobs(),
    listRecentDataJobRuns(),
  ]);

  return NextResponse.json({ jobs, runs });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as DataJobRunRequestBody;
  const jobKey = typeof body.jobKey === "string" ? body.jobKey.trim() : "";
  const dryRun = Boolean(body.dryRun);

  if (!jobKey) {
    return NextResponse.json({ error: "jobKey is required." }, { status: 400 });
  }

  const actor = await getUserById(session.user.id);

  if (!actor?.githubUsername) {
    return NextResponse.json(
      { error: "Unable to resolve the triggering super admin." },
      { status: 400 },
    );
  }

  try {
    const run = await runDataJob(
      jobKey,
      {
        userId: session.user.id,
        githubUsername: actor.githubUsername,
      },
      dryRun,
    );

    return NextResponse.json({ run });
  } catch (error) {
    if (error instanceof DbNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run data job.",
      },
      { status: 500 },
    );
  }
}
