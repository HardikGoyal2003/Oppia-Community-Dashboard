import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { TeamReviewersDocument } from "@/lib/domain/reviewer-teams.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreTeamReviewers,
  normalizeTeamReviewers,
  serializeTeamReviewers,
} from "./team-reviewers.mapper";

const db = getAdminFirestore();
const collection = db.collection(
  DB_PATHS.TEAM_REVIEWERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreTeamReviewers>;

/**
 * Retrieves team-reviewers document for a given platform.
 *
 * @param platform The contribution platform.
 * @returns The document, or null if not stored.
 */
export async function getTeamReviewers(
  platform: ContributionPlatform,
): Promise<TeamReviewersDocument | null> {
  const snapshot = await collection.doc(platform).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data();
  if (!data) return null;
  return normalizeTeamReviewers(data);
}

/**
 * Stores or replaces the team-reviewers document for a given platform.
 *
 * @param platform The contribution platform.
 * @param doc The document to persist.
 * @returns A promise that resolves when the write completes.
 */
export async function upsertTeamReviewers(
  platform: ContributionPlatform,
  doc: TeamReviewersDocument,
): Promise<void> {
  await collection.doc(platform).set(serializeTeamReviewers(doc));
}
