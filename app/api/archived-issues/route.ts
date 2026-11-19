import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { DbValidationError } from "@/lib/errors";
import {
  archiveIssue,
  getArchivedIssues,
  unarchiveIssue,
} from "@/lib/archived-issues/archived-issues.service";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Issue } from "@/lib/domain/issues.types";

type ArchivedIssueRequestBody = {
  issue: Issue;
  issueNumber: number;
  platform: string;
};

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function canSelectPlatform(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isIssue(value: Issue | null | undefined): value is Issue {
  if (!value) {
    return false;
  }

  return (
    typeof value.issueNumber === "number" &&
    Number.isInteger(value.issueNumber) &&
    value.issueNumber > 0 &&
    typeof value.issueUrl === "string" &&
    typeof value.issueTitle === "string" &&
    typeof value.lastCommentCreatedAt === "string" &&
    typeof value.linkedProject === "string"
  );
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const requestedPlatform = parsePlatform(searchParams.get("platform"));

  // Admins may inspect any platform; everyone else is limited to the
  // platform selected during sign-up.
  const platform =
    canSelectPlatform(session.user.role) && requestedPlatform
      ? requestedPlatform
      : session.user.platform;

  if (!platform) {
    return NextResponse.json(
      { error: "No contribution platform found for the current user." },
      { status: 400 },
    );
  }

  const archivedIssues = await getArchivedIssues(platform);
  return NextResponse.json({ archivedIssues });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedIssueRequestBody;
  const requestedPlatform = parsePlatform(body.platform);

  // Admins may modify any platform; everyone else is limited to the
  // platform selected during sign-up.
  const platform =
    canSelectPlatform(session.user.role) && requestedPlatform
      ? requestedPlatform
      : session.user.platform;

  if (!platform || !isIssue(body.issue)) {
    return NextResponse.json(
      { error: "Invalid archived issue payload." },
      { status: 400 },
    );
  }

  try {
    await archiveIssue(
      {
        issueNumber: body.issue.issueNumber,
        issueUrl: body.issue.issueUrl,
        issueTitle: body.issue.issueTitle,
        lastCommentCreatedAt: body.issue.lastCommentCreatedAt,
        linkedProject: body.issue.linkedProject,
      },
      platform,
      session.user.githubUsername,
    );
  } catch (error) {
    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedIssueRequestBody;
  const requestedPlatform = parsePlatform(body.platform);

  // Admins may modify any platform; everyone else is limited to the
  // platform selected during sign-up.
  const platform =
    canSelectPlatform(session.user.role) && requestedPlatform
      ? requestedPlatform
      : session.user.platform;

  if (
    !platform ||
    typeof body.issueNumber !== "number" ||
    !Number.isInteger(body.issueNumber) ||
    body.issueNumber <= 0
  ) {
    return NextResponse.json(
      { error: "Invalid archived issue payload." },
      { status: 400 },
    );
  }

  try {
    await unarchiveIssue(body.issueNumber, platform);
  } catch (error) {
    if (error instanceof DbValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return NextResponse.json({ success: true });
}
