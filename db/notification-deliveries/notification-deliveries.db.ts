import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { DbValidationError } from "@/db/db.errors";
import type { NotificationDeliveryModel } from "@/lib/domain/notifications.types";
import {
  normalizeNotificationDeliveryDocument,
  serializeNotificationDelivery,
} from "./notification-deliveries.mapper";
import type { FirestoreNotificationDelivery } from "./notification-deliveries.mapper";

const db = getAdminFirestore();
const notificationDeliveriesCollection = db.collection(
  DB_PATHS.NOTIFICATION_DELIVERIES.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreNotificationDelivery>;

/**
 * Retrieves a notification delivery by its deterministic id.
 *
 * @param id The delivery id (`kind__periodKey__teamKey__channel`).
 * @returns The normalized delivery, or null when it does not exist.
 */
export async function getNotificationDeliveryById(
  id: string,
): Promise<NotificationDeliveryModel | null> {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new DbValidationError(
      "id",
      "Notification delivery id must be a non-empty string.",
    );
  }

  const snapshot = await notificationDeliveriesCollection.doc(id).get();

  if (!snapshot.exists) {
    return null;
  }

  return normalizeNotificationDeliveryDocument(snapshot.id, snapshot.data()!);
}

/**
 * Records a notification delivery attempt. Overwrites the same id so retried
 * runs converge on the latest outcome.
 *
 * @param delivery The normalized notification delivery to persist.
 * @returns A promise that resolves when the delivery has been written.
 */
export async function recordNotificationDelivery(
  delivery: Omit<NotificationDeliveryModel, "schemaVersion">,
): Promise<void> {
  if (typeof delivery.id !== "string" || delivery.id.trim().length === 0) {
    throw new DbValidationError(
      "id",
      "Notification delivery id must be a non-empty string.",
    );
  }

  await notificationDeliveriesCollection
    .doc(delivery.id)
    .set(serializeNotificationDelivery(delivery));
}
