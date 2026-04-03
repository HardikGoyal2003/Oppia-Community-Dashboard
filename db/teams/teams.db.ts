import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { TeamModel } from "@/lib/domain/teams.types";
import { DB_PATHS } from "@/db/db-paths";
import {
  type FirestoreTeam,
  normalizeTeamDocument,
  serializeTeam,
} from "./teams.mapper";

const db = getAdminFirestore();
const teamsCollection = db.collection(
  DB_PATHS.TEAMS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreTeam>;

export type TeamRecord = TeamModel & {
  id: string;
};

/**
 * Retrieves a team by document id.
 *
 * @param teamId The stable team document id.
 * @returns The normalized team model, or null when the team does not exist.
 */
export async function getTeamById(teamId: string): Promise<TeamModel | null> {
  const snapshot = await teamsCollection.doc(teamId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return normalizeTeamDocument(data);
}

/**
 * Lists all teams, optionally filtered by platform.
 *
 * @param platform The optional contribution platform filter.
 * @returns The normalized teams with their document ids.
 */
export async function getTeams(
  platform?: ContributionPlatform,
): Promise<TeamRecord[]> {
  let query: FirebaseFirestore.Query<FirestoreTeam> = teamsCollection;

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snapshot = await query.orderBy("teamName", "asc").get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...normalizeTeamDocument(doc.data()),
  }));
}

/**
 * Creates or replaces a team document.
 *
 * @param teamId The stable team document id.
 * @param team The normalized team model to persist.
 * @returns A promise that resolves when the team has been written.
 */
export async function upsertTeam(
  teamId: string,
  team: TeamModel,
): Promise<void> {
  await teamsCollection.doc(teamId).set(serializeTeam(team));
}
