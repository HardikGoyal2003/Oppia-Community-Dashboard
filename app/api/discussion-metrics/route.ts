import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getDiscussionMetricHistory } from "@/lib/discussion-metrics/discussion-metrics.service";

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function canSelectPlatform(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const requestedPlatform = parsePlatform(
    new URL(req.url).searchParams.get("platform"),
  );

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

  try {
    const metrics = await getDiscussionMetricHistory(platform);

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to fetch discussion metrics." },
      { status: 500 },
    );
  }
}
