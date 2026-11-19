import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { DbValidationError } from "@/db/db.errors";
import {
  FIRESTORE_READ_CHUNK_SIZE,
  chunkValues,
  FIRESTORE_WRITE_BATCH_SIZE,
} from "@/db/utils/batch.utils";
import type { ActionItemModel } from "@/lib/domain/action-items.types";
import {
  type FirestoreActionItem,
  normalizeActionItemDocument,
  serializeActionItem,
} from "./action-items.mapper";

const db = getAdminFirestore();

/**
 * Action items live at `teams/{teamId}/actionItems/{ruleKey}`. The collection
 * group reference supports cross-team reads (admins and digests).
 */
const actionItemsCollectionGroup: FirebaseFirestore.CollectionGroup<FirestoreActionItem> =
  db.collectionGroup(
    DB_PATHS.ACTION_ITEMS.COLLECTION,
  ) as FirebaseFirestore.CollectionGroup<FirestoreActionItem>;

/**
 * Builds the CollectionReference for one team's action items.
 *
 * @param teamId The team document id (e.g. `WEB_CORE`).
 * @returns The Firestore collection reference.
 */
function getActionItemsCollectionRef(
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
function getActionItemDocumentRef(
  teamId: string,
  itemId: string,
): FirebaseFirestore.DocumentReference<FirestoreActionItem> {
  return getActionItemsCollectionRef(teamId).doc(
    itemId,
  ) as FirebaseFirestore.DocumentReference<FirestoreActionItem>;
}

/**
 * Resolves the parent team id from an action-item document reference.
 *
 * Action items live at `teams/{teamId}/actionItems/{itemId}`; the team id is
 * the id of the document that owns the action-items subcollection.
 *
 * @param ref The action-item document reference.
 * @returns The team document id.
 * @throws {DbValidationError} When the document is not nested under a team.
 */
function resolveTeamIdFromRef(
  ref: FirebaseFirestore.DocumentReference<FirestoreActionItem>,
): string {
  const teamId = ref.parent.parent?.id;

  if (!teamId) {
    throw new DbValidationError(
      "path",
      `Invalid action item document path: ${ref.path}`,
    );
  }

  return teamId;
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
      teamId: resolveTeamIdFromRef(doc.ref),
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
 * Inserts or updates action items. Document ids are the rule keys within a
 * team, so repeated syncs upsert instead of duplicating.
 *
 * @param items The action items to persist.
 * @returns A promise that resolves when all batches are committed.
 */
export async function upsertActionItems(
  items: Array<Omit<ActionItemModel, "schemaVersion">>,
): Promise<void> {
  const byTeam = new Map<
    string,
    Array<Omit<ActionItemModel, "schemaVersion">>
  >();

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

  for (const chunk of chunkValues(writes, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = actionItemsCollectionGroup.firestore.batch();

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

  for (const chunk of chunkValues(writes, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = actionItemsCollectionGroup.firestore.batch();

    for (const ref of chunk) {
      batch.delete(ref);
    }

    await batch.commit();
  }
}

/**
 * Marks items as notified by the latest digest.
 *
 * Uses chunked reads and batched updates so notification counters are
 * incremented efficiently while preserving existing first-notification times and
 * never moving the last-notification time backwards.
 *
 * @param items The items that were included in a digest.
 * @param notifiedAt The time the digest was delivered.
 * @returns The ids of updated and skipped (missing) action items.
 */
export async function markActionItemsNotified(
  items: ActionItemModel[],
  notifiedAt: Date,
): Promise<{ updatedIds: string[]; skippedIds: string[] }> {
  if (items.length === 0) {
    return { updatedIds: [], skippedIds: [] };
  }

  const notifiedAtTimestamp = Timestamp.fromDate(notifiedAt);
  const notifiedAtMs = notifiedAt.getTime();
  const updatedIds: string[] = [];
  const skippedIds: string[] = [];
  const updates: Array<{
    ref: FirebaseFirestore.DocumentReference<FirestoreActionItem>;
    data: FirebaseFirestore.UpdateData<FirestoreActionItem>;
  }> = [];

  const refs = items.map((item) =>
    getActionItemDocumentRef(item.teamId, item.id),
  );

  for (const refChunk of chunkValues(refs, FIRESTORE_READ_CHUNK_SIZE)) {
    const snapshots = (await actionItemsCollectionGroup.firestore.getAll(
      ...refChunk,
    )) as FirebaseFirestore.DocumentSnapshot<FirestoreActionItem>[];

    for (const snapshot of snapshots) {
      if (!snapshot.exists) {
        skippedIds.push(snapshot.id);
        continue;
      }

      const data = snapshot.data();
      const existingLastNotifiedAt = data?.lastNotifiedAt;
      const lastNotifiedAt =
        existingLastNotifiedAt &&
        existingLastNotifiedAt.toMillis() > notifiedAtMs
          ? existingLastNotifiedAt
          : notifiedAtTimestamp;

      const update: FirebaseFirestore.UpdateData<FirestoreActionItem> = {
        notificationCount: FieldValue.increment(1),
        lastNotifiedAt,
      };

      if (!data?.firstNotifiedAt) {
        update.firstNotifiedAt = notifiedAtTimestamp;
      }

      updates.push({ ref: snapshot.ref, data: update });
      updatedIds.push(snapshot.id);
    }
  }

  for (const chunk of chunkValues(updates, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = actionItemsCollectionGroup.firestore.batch();

    for (const update of chunk) {
      batch.update(update.ref, update.data);
    }

    await batch.commit();
  }

  return { updatedIds, skippedIds };
}
