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

type CachedOrgMeta = {
  orgMembers: string[];
  collaborators: { login: string; permission: string }[];
  lastUpdated: string;
};

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
    const platform = session.user.platform;

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

    let clientOrgMeta: OrgMetaRecord | undefined;

    try {
      const body = await req.json();
      if (body.orgMeta && isValidCachedOrgMeta(body.orgMeta)) {
        clientOrgMeta = toOrgMetaRecord(body.orgMeta);
      }
    } catch {
      // No body or invalid JSON — proceed without client orgMeta.
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
