import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreReviewerTeamsDocument,
  normalizeReviewerTeamsDocument,
  serializeReviewerTeamsDocument,
} from "./reviewer-teams.mapper";

const db = getAdminFirestore();
const reviewerTeamsCollection = db.collection(
  DB_PATHS.REVIEWER_TEAMS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreReviewerTeamsDocument>;

export async function getReviewerTeamsDocument(
  platform: ContributionPlatform,
): Promise<ReviewerTeamsDocument | null> {
  const snapshot = await reviewerTeamsCollection.doc(platform).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return normalizeReviewerTeamsDocument(data);
}

export async function upsertReviewerTeamsDocument(
  document: ReviewerTeamsDocument,
): Promise<void> {
  await reviewerTeamsCollection
    .doc(document.platform)
    .set(serializeReviewerTeamsDocument(document));
}
