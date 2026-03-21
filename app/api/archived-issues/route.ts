import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  archiveIssue,
  getArchivedIssues,
  unarchiveIssue,
} from "@/db/archived-issues.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/features/dashboard/dashboard.types";

function parsePlatform(value: unknown): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function isIssue(value: unknown): value is Issue {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.issueNumber === "number" &&
    typeof candidate.issueUrl === "string" &&
    typeof candidate.issueTitle === "string" &&
    typeof candidate.isArchived === "boolean" &&
    typeof candidate.lastCommentCreatedAt === "string" &&
    typeof candidate.linkedProject === "string"
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const platform = parsePlatform(searchParams.get("platform"));

  if (!platform) {
    return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
  }

  const archivedIssues = await getArchivedIssues(platform);
  return NextResponse.json({ archivedIssues });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as {
    issue?: unknown;
    platform?: unknown;
  };
  const platform = parsePlatform(body.platform);

  if (!platform || !isIssue(body.issue)) {
    return NextResponse.json(
      { error: "Invalid archived issue payload." },
      { status: 400 },
    );
  }

  await archiveIssue(body.issue, platform);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as {
    issueNumber?: unknown;
    platform?: unknown;
  };
  const platform = parsePlatform(body.platform);

  if (!platform || typeof body.issueNumber !== "number") {
    return NextResponse.json(
      { error: "Invalid archived issue payload." },
      { status: 400 },
    );
  }

  await unarchiveIssue(body.issueNumber, platform);
  return NextResponse.json({ success: true });
}
