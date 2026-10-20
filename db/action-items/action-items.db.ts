import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type { ActionItemModel } from "@/lib/domain/action-items.types";
import {
  type FirestoreActionItem,
  normalizeActionItemDocument,
  serializeActionItem,
  serializeActionItemEscalationUpdate,
  serializeActionItemNotificationUpdate,
} from "./action-items.mapper";

const db = getAdminFirestore();

/**
 * Action items live at `teams/{teamId}/actionItems/{ruleKey}`. The collection
 * group reference supports cross-team reads (admins, digests, escalation).
 */
export const actionItemsCollectionGroup: FirebaseFirestore.CollectionGroup<FirestoreActionItem> =
  db.collectionGroup(
    DB_PATHS.ACTION_ITEMS.COLLECTION,
  ) as FirebaseFirestore.CollectionGroup<FirestoreActionItem>;

/** Maximum number of writes committed per Firestore batch. */
const FIRESTORE_BATCH_LIMIT = 400;

/**
 * Builds the CollectionReference for one team's action items.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @returns The Firestore collection reference.
 */
export function getActionItemsCollectionRef(
  teamId: string,
): FirebaseFirestore.CollectionReference<FirestoreActionItem> {
  return db
    .collection(DB_PATHS.TEAMS.COLLECTION)
    .doc(teamId)
    .collection(
      DB_PATHS.ACTION_ITEMS.COLLECTION,
    ) as FirebaseFirestore.CollectionReference<FirestoreActionItem>;
}

/**
 * Builds the DocumentReference for one action item.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @param itemId The action item document id (the rule key).
 * @returns The Firestore document reference.
 */
export function getActionItemDocumentRef(
  teamId: string,
  itemId: string,
): FirebaseFirestore.DocumentReference<FirestoreActionItem> {
  return getActionItemsCollectionRef(teamId).doc(
    itemId,
  ) as FirebaseFirestore.DocumentReference<FirestoreActionItem>;
}

/**
 * Splits a list into fixed-size chunks so writes stay within batch limits.
 *
 * @param values The values to split.
 * @param size The maximum chunk size.
 * @returns The chunked values.
 */
function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

/**
 * Resolves the parent team id from a collection-group document path like
 * `teams/WEB_CORE/actionItems/gfi-shortfall`.
 *
 * @param path The document path.
 * @returns The team document id.
 */
function resolveTeamIdFromPath(path: string): string {
  const segments = path.split("/");
  // teams/{teamId}/actionItems/{itemId}
  return segments[1] ?? "";
}

/**
 * Retrieves every tracked action item across all teams (collection group).
 *
 * @returns The normalized action items.
 */
export async function getActionItems(): Promise<ActionItemModel[]> {
  const snapshot = await actionItemsCollectionGroup.get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();

    return normalizeActionItemDocument({
      id: doc.id,
      teamId: resolveTeamIdFromPath(doc.ref.path),
      data,
    });
  });
}

/**
 * Retrieves the action items belonging to one team.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @returns The team's normalized action items.
 */
export async function getActionItemsByTeamId(
  teamId: string,
): Promise<ActionItemModel[]> {
  const snapshot = await getActionItemsCollectionRef(teamId).get();

  return snapshot.docs.map((doc) =>
    normalizeActionItemDocument({ id: doc.id, teamId, data: doc.data() }),
  );
}

/**
 * Retrieves a single action item by its team and document id.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @param itemId The action item document id (the rule key).
 * @returns The normalized action item, or null when it does not exist.
 */
export async function getActionItemById(
  teamId: string,
  itemId: string,
): Promise<ActionItemModel | null> {
  const snapshot = await getActionItemDocumentRef(teamId, itemId).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return normalizeActionItemDocument({ id: snapshot.id, teamId, data });
}

/**
 * Inserts or updates action items. Document ids are the rule keys within a
 * team, so repeated syncs upsert instead of duplicating.
 *
 * @param items The action items to persist.
 * @returns A promise that resolves when all batches are committed.
 */
export async function upsertActionItems(
  items: ActionItemModel[],
): Promise<void> {
  const byTeam = new Map<string, ActionItemModel[]>();

  for (const item of items) {
    const existing = byTeam.get(item.teamId);

    if (existing) {
      existing.push(item);
    } else {
      byTeam.set(item.teamId, [item]);
    }
  }

  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference<FirestoreActionItem>;
    data: FirestoreActionItem;
  }> = [];

  for (const [teamId, teamItems] of byTeam) {
    for (const item of teamItems) {
      writes.push({
        ref: getActionItemDocumentRef(teamId, item.id),
        data: serializeActionItem(item),
      });
    }
  }

  for (const chunk of chunkValues(writes, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();

    for (const write of chunk) {
      batch.set(write.ref, write.data);
    }

    await batch.commit();
  }
}

/**
 * Deletes action items whose rules are no longer present in the latest report.
 *
 * @param items The stale action items to remove.
 * @returns A promise that resolves when all batches are committed.
 */
export async function deleteActionItems(
  items: ActionItemModel[],
): Promise<void> {
  const writes = items.map((item) =>
    getActionItemDocumentRef(item.teamId, item.id),
  );

  for (const chunk of chunkValues(writes, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();

    for (const ref of chunk) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}

/**
 * Marks items as notified by the latest digest.
 *
 * @param items The items that were included in a digest.
 * @param notifiedAt The time the digest was delivered.
 * @returns A promise that resolves when all batches are committed.
 */
export async function markActionItemsNotified(
  items: ActionItemModel[],
  notifiedAt: Date,
): Promise<void> {
  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference<FirestoreActionItem>;
    data: Partial<FirestoreActionItem>;
  }> = [];

  for (const item of items) {
    writes.push({
      ref: getActionItemDocumentRef(item.teamId, item.id),
      data: serializeActionItemNotificationUpdate(
        item.firstNotifiedAt,
        notifiedAt,
        item.notificationCount + 1,
      ),
    });
  }

  for (const chunk of chunkValues(writes, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();

    for (const write of chunk) {
      batch.update(write.ref, write.data);
    }

    await batch.commit();
  }
}

/**
 * Records escalation nudges by bumping each item's escalation level.
 *
 * @param updates The per-item escalation updates to persist.
 * @returns A promise that resolves when all batches are committed.
 */
export async function updateActionItemsEscalation(
  updates: Array<{
    teamId: string;
    itemId: string;
    escalationLevel: number;
    lastEscalatedAt: Date;
  }>,
): Promise<void> {
  const writes: Array<{
    ref: FirebaseFirestore.DocumentReference<FirestoreActionItem>;
    data: Partial<FirestoreActionItem>;
  }> = [];

  for (const update of updates) {
    writes.push({
      ref: getActionItemDocumentRef(update.teamId, update.itemId),
      data: serializeActionItemEscalationUpdate(
        update.escalationLevel,
        update.lastEscalatedAt,
      ),
    });
  }

  for (const chunk of chunkValues(writes, FIRESTORE_BATCH_LIMIT)) {
    const batch = db.batch();

    for (const write of chunk) {
      batch.update(write.ref, write.data);
    }

    await batch.commit();
  }
}
