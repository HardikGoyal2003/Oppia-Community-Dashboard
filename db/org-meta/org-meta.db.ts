import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreOrgMeta,
  type OrgMetaRecord,
  normalizeOrgMetaDocument,
  serializeOrgMeta,
} from "./org-meta.mapper";

const db = getAdminFirestore();
const orgMetaCollection = db.collection(
  DB_PATHS.ORG_META.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreOrgMeta>;

/**
 * Retrieves org meta for a given platform.
 *
 * @param platform The contribution platform.
 * @returns The org meta record, or null if not stored.
 */
export async function getOrgMeta(
  platform: ContributionPlatform,
): Promise<OrgMetaRecord | null> {
  const snapshot = await orgMetaCollection.doc(platform).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return normalizeOrgMetaDocument(data);
}

/**
 * Stores or replaces org meta for a given platform.
 *
 * @param platform The contribution platform.
 * @param orgMeta The org meta to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function upsertOrgMeta(
  platform: ContributionPlatform,
  orgMeta: OrgMetaRecord,
): Promise<void> {
  await orgMetaCollection.doc(platform).set(serializeOrgMeta(orgMeta));
}
