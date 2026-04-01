import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { TeamModel } from "@/lib/domain/teams.types";
import { DB_PATHS } from "@/db/db-paths";
import { DbNotFoundError } from "@/db/db.errors";
import { normalizeTeamDocument, serializeTeam } from "./teams.mapper";

const db = getAdminFirestore();

/**
 * Retrieves a team by document id.
 *
 * @param teamId The stable team document id.
 * @returns The normalized team model, or null when the team does not exist.
 */
export async function getTeamById(teamId: string): Promise<TeamModel | null> {
  const snapshot = await db
    .collection(DB_PATHS.TEAMS.COLLECTION)
    .doc(teamId)
    .get();

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
): Promise<(TeamModel & { id: string })[]> {
  let query: FirebaseFirestore.Query = db.collection(DB_PATHS.TEAMS.COLLECTION);

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
  await db
    .collection(DB_PATHS.TEAMS.COLLECTION)
    .doc(teamId)
    .set(serializeTeam(team));
}

/**
 * Updates the GFI counts and last-updated timestamp for an existing team.
 *
 * @param teamId The stable team document id.
 * @param team The partial team fields to update.
 * @returns A promise that resolves when the update has been written.
 */
export async function updateTeamMetricsMetadata(
  teamId: string,
  team: Pick<TeamModel, "gfiCounts" | "lastUpdated">,
): Promise<void> {
  const docRef = db.collection(DB_PATHS.TEAMS.COLLECTION).doc(teamId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    throw new DbNotFoundError("Team");
  }

  const existingTeam = snapshot.data();

  if (!existingTeam) {
    throw new DbNotFoundError("Team");
  }

  const normalizedTeam = normalizeTeamDocument(existingTeam);

  await docRef.update({
    gfiCounts: {
      backend: team.gfiCounts.backend,
      frontend: team.gfiCounts.frontend,
      fullstack: team.gfiCounts.fullstack,
      uncategorized: team.gfiCounts.uncategorized,
    },
    leads: normalizedTeam.leads.map((lead) => ({
      uid: lead.uid,
      username: lead.username,
    })),
    platform: normalizedTeam.platform,
    teamName: normalizedTeam.teamName,
    lastUpdated: serializeTeam({
      ...normalizedTeam,
      ...team,
    }).lastUpdated,
  });
}
