import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  listAvailableCronJobs,
  runCronJob,
} from "@/lib/cron-jobs/manual-cron-jobs.service";

type CronJobRunRequestBody = {
  jobKey?: string;
};

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

function isSuperAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export async function GET() {
  if (!isDevelopmentMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  return NextResponse.json({ jobs: listAvailableCronJobs() });
}

export async function POST(req: Request) {
  if (!isDevelopmentMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as CronJobRunRequestBody;
  const jobKey = typeof body.jobKey === "string" ? body.jobKey.trim() : "";

  if (!jobKey) {
    return NextResponse.json({ error: "jobKey is required." }, { status: 400 });
  }

  try {
    const run = await runCronJob(jobKey);
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run cron job.",
      },
      { status: 500 },
    );
  }
}
