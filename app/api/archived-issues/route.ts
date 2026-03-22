import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  archiveIssue,
  getArchivedIssues,
  unarchiveIssue,
} from "@/db/archived-issues/archived-issues.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";

type ArchivedIssueRequestBody = {
  issue?: Partial<Issue> | null;
  issueNumber?: number | null;
  platform?: string | null;
};

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function isIssue(value: Partial<Issue> | null | undefined): value is Issue {
  if (!value) {
    return false;
  }

  return (
    typeof value.issueNumber === "number" &&
    typeof value.issueUrl === "string" &&
    typeof value.issueTitle === "string" &&
    typeof value.isArchived === "boolean" &&
    typeof value.lastCommentCreatedAt === "string" &&
    typeof value.linkedProject === "string"
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

  const body = (await req.json()) as ArchivedIssueRequestBody;
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

  const body = (await req.json()) as ArchivedIssueRequestBody;
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
