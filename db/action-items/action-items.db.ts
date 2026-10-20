import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { getRequiredDocumentSnapshot } from "@/db/utils/document.utils";
import type { ActionItemModel } from "@/lib/domain/action-items.types";
import {
  type ActionItemStatusUpdate,
  type FirestoreActionItem,
  normalizeActionItemDocument,
  serializeActionItem,
  serializeActionItemNotificationUpdate,
  serializeActionItemStatusUpdate,
} from "./action-items.mapper";

const db = getAdminFirestore();
export const actionItemsCollection = db.collection(
  DB_PATHS.ACTION_ITEMS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreActionItem>;

/** Maximum number of writes committed per Firestore batch. */
const FIRESTORE_BATCH_LIMIT = 400;

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
 * Lists every persisted action item.
 *
 * @returns The normalized action items.
 */
export async function getActionItems(): Promise<ActionItemModel[]> {
  const snapshot = await actionItemsCollection.get();

  return snapshot.docs.map((doc) =>
    normalizeActionItemDocument({
      ...doc.data(),
      id: doc.id,
    }),
  );
}

/**
 * Retrieves an action item by document id.
 *
 * @param id The deterministic action item id.
 * @returns The normalized action item, or null when it does not exist.
 */
export async function getActionItemById(
  id: string,
): Promise<ActionItemModel | null> {
  const snapshot = await actionItemsCollection.doc(id).get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();

  if (!data) {
    return null;
  }

  return normalizeActionItemDocument({ ...data, id: snapshot.id });
}

/**
 * Lists action items for a single team key.
 *
 * @param teamKey The team key stored on user records (e.g. "CORE").
 * @returns The normalized action items for the team.
 */
export async function getActionItemsByTeamKey(
  teamKey: string,
): Promise<ActionItemModel[]> {
  const snapshot = await actionItemsCollection
    .where("teamKey", "==", teamKey)
    .get();

  return snapshot.docs.map((doc) =>
    normalizeActionItemDocument({
      ...doc.data(),
      id: doc.id,
    }),
  );
}

/**
 * Creates or replaces action item documents.
 *
 * @param items The normalized action items to persist.
 * @returns A promise that resolves when all writes are committed.
 */
export async function upsertActionItems(
  items: ActionItemModel[],
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  for (const chunk of chunkValues(items, FIRESTORE_BATCH_LIMIT)) {
    const batch = actionItemsCollection.firestore.batch();

    for (const item of chunk) {
      batch.set(actionItemsCollection.doc(item.id), serializeActionItem(item));
    }

    await batch.commit();
  }
}

/**
 * Applies a review status transition to an existing action item.
 *
 * @param id The deterministic action item id.
 * @param update The normalized status patch.
 * @returns A promise that resolves when the update has been written.
 */
export async function updateActionItemStatusById(
  id: string,
  update: ActionItemStatusUpdate,
): Promise<void> {
  const docRef = actionItemsCollection.doc(id);
  await getRequiredDocumentSnapshot("ActionItem", docRef);

  await docRef.update(serializeActionItemStatusUpdate(update));
}

/**
 * Records that a digest included the given action items.
 *
 * @param items The items that were included, with their current notification fields.
 * @param notifiedAt The notification timestamp to persist.
 * @returns A promise that resolves when all notification counters are updated.
 */
export async function markActionItemsNotified(
  items: Array<
    Pick<ActionItemModel, "id" | "firstNotifiedAt" | "notificationCount">
  >,
  notifiedAt: Date,
): Promise<void> {
  if (items.length === 0) {
    return;
  }

  for (const chunk of chunkValues(items, FIRESTORE_BATCH_LIMIT)) {
    const batch = actionItemsCollection.firestore.batch();

    for (const item of chunk) {
      batch.update(
        actionItemsCollection.doc(item.id),
        serializeActionItemNotificationUpdate(
          item.firstNotifiedAt,
          notifiedAt,
          item.notificationCount + 1,
        ),
      );
    }

    await batch.commit();
  }
}
