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
    typeof value.lastCommentCreatedAt === "string"
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

  const archivedDiscussions = await getArchivedDiscussions(platform);
  return NextResponse.json({ archivedDiscussions });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedDiscussionRequestBody;
  const platform = parsePlatform(body.platform);

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

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = (await req.json()) as ArchivedDiscussionRequestBody;
  const platform = parsePlatform(body.platform);

  if (!platform || typeof body.discussionNumber !== "number") {
    return NextResponse.json(
      { error: "Invalid archived discussion payload." },
      { status: 400 },
    );
  }

  await unarchiveDiscussion(body.discussionNumber, platform);
  return NextResponse.json({ success: true });
}
