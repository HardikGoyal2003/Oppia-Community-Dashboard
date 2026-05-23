import { GITHUB_REPOS } from "@/lib/config/github.constants";
import { fetchOrgAndCollaboratorAccess } from "@/lib/github/github.query-helpers";
import { upsertOrgMeta } from "@/db/org-meta/org-meta.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

type SyncOrgMetaSummary = {
  platforms: ContributionPlatform[];
  orgMemberCount: number;
  collaboratorCount: number;
  lastUpdated: string;
};

type PlatformCounts = {
  orgMemberCount: number;
  collaboratorCount: number;
};

/**
 * Fetches org members and collaborators from GitHub for a single platform
 * and persists them to Firestore.
 *
 * @param platform The contribution platform to sync.
 * @returns The counts of members and collaborators stored.
 */
async function syncPlatform(
  platform: ContributionPlatform,
): Promise<PlatformCounts> {
  const target = GITHUB_REPOS[platform];
  const orgData = await fetchOrgAndCollaboratorAccess(target);

  const orgMembers = orgData.organization.membersWithRole.nodes.map(
    (m) => m.login,
  );

  const collaborators = orgData.repository.collaborators.edges.map((entry) => ({
    login: entry.node.login,
    permission: entry.permission,
  }));

  await upsertOrgMeta(platform, {
    orgMembers,
    collaborators,
    lastUpdated: new Date(),
  });

  return {
    orgMemberCount: orgMembers.length,
    collaboratorCount: collaborators.length,
  };
}

/**
 * Syncs org member and collaborator data from GitHub to Firestore
 * for all platforms (WEB and ANDROID).
 *
 * Intended to be called by a cron job every 3 days at 3 AM IST.
 *
 * @returns A summary of what was synced.
 */
export async function syncOrgMeta(): Promise<SyncOrgMetaSummary> {
  const platforms: ContributionPlatform[] = ["WEB", "ANDROID"];

  const counts = await Promise.all(platforms.map(syncPlatform));

  const lastUpdated = new Date().toISOString();

  return {
    platforms,
    orgMemberCount: counts.reduce((sum, c) => sum + c.orgMemberCount, 0),
    collaboratorCount: counts.reduce((sum, c) => sum + c.collaboratorCount, 0),
    lastUpdated,
  };
}
