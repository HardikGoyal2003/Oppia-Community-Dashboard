import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import {
  archiveDiscussion,
  getArchivedDiscussions,
  unarchiveDiscussion,
} from "@/db/archived-discussions/archived-discussions.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { Discussion } from "@/lib/domain/discussions.types";

type ArchivedDiscussionRequestBody = {
  discussion: Discussion;
  discussionNumber: number;
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

function isDiscussion(
  value: Discussion | null | undefined,
): value is Discussion {
  if (!value) {
    return false;
  }

  return (
    typeof value.discussionNumber === "number" &&
    typeof value.discussionUrl === "string" &&
    typeof value.discussionTitle === "string" &&
    typeof value.isArchived === "boolean" &&
    typeof value.createdAt === "string"
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

  const archivedDiscussions = await getArchivedDiscussions(platform);
  return NextResponse.json({ archivedDiscussions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedDiscussionRequestBody;
  const requestedPlatform = parsePlatform(body.platform);

  // Admins may modify any platform; everyone else is limited to the
  // platform selected during sign-up.
  const platform =
    canSelectPlatform(session.user.role) && requestedPlatform
      ? requestedPlatform
      : session.user.platform;

  if (!platform || !isDiscussion(body.discussion)) {
    return NextResponse.json(
      { error: "Invalid archived discussion payload." },
      { status: 400 },
    );
  }

  await archiveDiscussion(
    body.discussion,
    platform,
    session.user.githubUsername,
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedDiscussionRequestBody;
  const requestedPlatform = parsePlatform(body.platform);

  // Admins may modify any platform; everyone else is limited to the
  // platform selected during sign-up.
  const platform =
    canSelectPlatform(session.user.role) && requestedPlatform
      ? requestedPlatform
      : session.user.platform;

  if (!platform || typeof body.discussionNumber !== "number") {
    return NextResponse.json(
      { error: "Invalid archived discussion payload." },
      { status: 400 },
    );
  }

  await unarchiveDiscussion(body.discussionNumber, platform);
  return NextResponse.json({ success: true });
}
