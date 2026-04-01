import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { generateTeamReportsDummyData } from "@/lib/dev/generate-team-reports-dummy-data.service";

type DummyDataRequestBody = {
  generatorKey?: string;
};

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV === "development";
}

function isSuperAdmin(role: string | undefined): boolean {
  return role === "SUPER_ADMIN";
}

export async function POST(req: Request) {
  if (!isDevelopmentMode()) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getServerSession(authOptions);

  if (!session || !session.user || !isSuperAdmin(session.user.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as DummyDataRequestBody;
  const generatorKey =
    typeof body.generatorKey === "string" ? body.generatorKey.trim() : "";

  if (generatorKey !== "team_reports") {
    return NextResponse.json(
      { error: "Unsupported dummy data generator." },
      { status: 400 },
    );
  }

  try {
    const summary = await generateTeamReportsDummyData();

    return NextResponse.json({
      summary: [
        "Dummy data generated successfully.",
        `Teams written: ${summary.teamsWritten}.`,
        `Daily team metric snapshots written: ${summary.metricsWritten}.`,
      ].join("\n"),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate dummy data.",
      },
      { status: 500 },
    );
  }
}
