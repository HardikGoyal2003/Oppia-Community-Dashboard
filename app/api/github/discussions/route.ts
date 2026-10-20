import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { GITHUB_REPOS } from "@/lib/config";
import {
  fetchUnansweredDiscussions,
  GitHubGraphQLError,
} from "@/lib/github/github.fetcher";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function canSelectPlatform(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    let requestedPlatform: ContributionPlatform | null = null;

    try {
      const body = await req.json();
      requestedPlatform = parsePlatform(body.platform);
    } catch {
      // No body or invalid JSON — fall back to the session platform.
    }

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

    const repoTarget = GITHUB_REPOS[platform];

    if (!repoTarget) {
      return NextResponse.json(
        { error: `No GitHub repo configured for platform: ${platform}` },
        { status: 500 },
      );
    }

    const discussions = await fetchUnansweredDiscussions(repoTarget, platform);

    return NextResponse.json({ discussions });
  } catch (error) {
    console.error(error);

    if (error instanceof GitHubGraphQLError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch GitHub discussions" },
      { status: 500 },
    );
  }
}
