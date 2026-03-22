import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { updateUserPlatformByUid } from "@/db/users/users.db";
import { ContributionPlatform } from "@/lib/auth/auth.types";
import { DbNotFoundError } from "@/db/db.errors";

type PlatformRequestBody = {
  platform?: string | null;
};

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (trimmed === "WEB") return "WEB";
  if (trimmed === "ANDROID") return "ANDROID";
  return null;
}

// Allows the logged-in user to set their own contribution platform.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req
    .json()
    .catch(() => null)) as PlatformRequestBody | null;
  const platform = parsePlatform(body?.platform);

  if (!platform) {
    return NextResponse.json(
      { error: "Invalid platform. Expected WEB or ANDROID." },
      { status: 400 },
    );
  }

  try {
    await updateUserPlatformByUid(session.user.id, platform);
  } catch (error) {
    if (error instanceof DbNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    throw error;
  }

  return NextResponse.json({ success: true, platform });
}
