import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getOrgMeta } from "@/db/org-meta/org-meta.db";
import type { OrgMetaRecord } from "@/db/org-meta/org-meta.mapper";

export type StoredOrgMeta = {
  orgMembers: string[];
  collaborators: OrgMetaRecord["collaborators"];
  lastUpdated: string;
};

export type ClientOrgMetaInput = {
  orgMembers: string[];
  collaborators: { login: string; permission: string }[];
  lastUpdated: string;
};

export type FetcherOrgMeta = Omit<OrgMetaRecord, "schemaVersion">;

/**
 * Determines whether a value is a valid client-cached org-meta payload.
 *
 * @param data The candidate client payload.
 * @returns True when the payload has the expected shape.
 */
export function isValidCachedOrgMeta(
  data: object | null,
): data is ClientOrgMetaInput {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Partial<ClientOrgMetaInput>;
  return (
    Array.isArray(obj.orgMembers) &&
    Array.isArray(obj.collaborators) &&
    typeof obj.lastUpdated === "string"
  );
}

/**
 * Converts client-cached org meta into the shape expected by GitHub fetchers.
 *
 * @param cached The validated client-cached org meta.
 * @returns The normalized org-meta input for fetchers.
 */
export function toFetcherOrgMeta(cached: ClientOrgMetaInput): FetcherOrgMeta {
  return {
    orgMembers: cached.orgMembers,
    collaborators: cached.collaborators,
    lastUpdated: new Date(cached.lastUpdated),
  };
}

/**
 * Retrieves stored org meta for a platform in API response shape.
 *
 * @param platform The contribution platform.
 * @returns The stored org meta, or null when not available.
 */
export async function getStoredOrgMeta(
  platform: ContributionPlatform,
): Promise<StoredOrgMeta | null> {
  const orgMeta = await getOrgMeta(platform);

  if (!orgMeta) {
    return null;
  }

  return {
    orgMembers: orgMeta.orgMembers,
    collaborators: orgMeta.collaborators,
    lastUpdated: orgMeta.lastUpdated.toISOString(),
  };
}
