import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth.options";
import { GITHUB_REPOS } from "@/lib/config";
import {
  fetchUnansweredIssues,
  GitHubGraphQLError,
} from "@/lib/github/github.fetcher";
import { getOrgMeta } from "@/db/org-meta/org-meta.db";
import type { OrgMetaRecord } from "@/db/org-meta/org-meta.mapper";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type CachedOrgMeta = {
  orgMembers: string[];
  collaborators: { login: string; permission: string }[];
  lastUpdated: string;
};

function parsePlatform(
  value: string | null | undefined,
): ContributionPlatform | null {
  return value === "WEB" || value === "ANDROID" ? value : null;
}

function canSelectPlatform(role: string | undefined): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function isValidCachedOrgMeta(data: unknown): data is CachedOrgMeta {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.orgMembers) &&
    Array.isArray(obj.collaborators) &&
    typeof obj.lastUpdated === "string"
  );
}

function toOrgMetaRecord(cached: CachedOrgMeta): OrgMetaRecord {
  return {
    orgMembers: cached.orgMembers,
    collaborators: cached.collaborators,
    lastUpdated: new Date(cached.lastUpdated),
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user || session.invalidUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    let clientOrgMeta: OrgMetaRecord | undefined;
    let requestedPlatform: ContributionPlatform | null = null;

    try {
      const body = await req.json();
      if (body.orgMeta && isValidCachedOrgMeta(body.orgMeta)) {
        clientOrgMeta = toOrgMetaRecord(body.orgMeta);
      }
      requestedPlatform = parsePlatform(body.platform);
    } catch {
      // No body or invalid JSON — proceed without client orgMeta.
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

    const issuesData = await fetchUnansweredIssues(
      repoTarget,
      platform,
      clientOrgMeta,
    );

    const orgMeta = await getOrgMeta(platform);
    return NextResponse.json({
      issues: issuesData,
      orgMeta: orgMeta
        ? {
            orgMembers: orgMeta.orgMembers,
            collaborators: orgMeta.collaborators,
            lastUpdated: orgMeta.lastUpdated.toISOString(),
          }
        : null,
    });
  } catch (error) {
    console.error(error);

    if (error instanceof GitHubGraphQLError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch GitHub issues" },
      { status: 500 },
    );
  }
}
