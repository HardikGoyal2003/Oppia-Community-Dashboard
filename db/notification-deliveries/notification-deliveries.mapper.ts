import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type {
  NotificationChannelKey,
  NotificationDeliveryModel,
  NotificationDeliveryStatus,
} from "@/lib/domain/notifications.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  assertNonEmptyString,
  assertNonNegativeNumber,
} from "@/db/utils/validation.utils";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type FirestoreNotificationDelivery = Omit<
  NotificationDeliveryModel,
  "id" | "recordedAt"
> & {
  recordedAt: Timestamp;
};

const NOTIFICATION_CHANNELS: readonly NotificationChannelKey[] = [
  "EMAIL",
  "IN_APP",
];

const DELIVERY_STATUSES: readonly NotificationDeliveryStatus[] = [
  "SENT",
  "SKIPPED",
  "FAILED",
];

/**
 * Validates the raw Firestore notification delivery document shape.
 *
 * @param delivery The raw Firestore notification delivery data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreNotificationDelivery(
  delivery: FirebaseFirestore.DocumentData,
): asserts delivery is FirestoreNotificationDelivery {
  assertNonEmptyString(
    "kind",
    delivery.kind,
    "Delivery kind must be a non-empty string.",
  );

  if (!NOTIFICATION_CHANNELS.includes(delivery.channel)) {
    throw new DbValidationError(
      "channel",
      "Delivery channel must be EMAIL or IN_APP.",
    );
  }

  assertNonEmptyString(
    "teamKey",
    delivery.teamKey,
    "Delivery teamKey must be a non-empty string.",
  );
  assertNonEmptyString(
    "periodKey",
    delivery.periodKey,
    "Delivery periodKey must be a non-empty string.",
  );

  if (
    !Array.isArray(delivery.recipientUids) ||
    delivery.recipientUids.some((uid) => typeof uid !== "string")
  ) {
    throw new DbValidationError(
      "recipientUids",
      "Delivery recipientUids must be an array of strings.",
    );
  }

  if (
    delivery.actionItemIds !== undefined &&
    (!Array.isArray(delivery.actionItemIds) ||
      delivery.actionItemIds.some((id) => typeof id !== "string"))
  ) {
    throw new DbValidationError(
      "actionItemIds",
      "Delivery actionItemIds must be an array of strings.",
    );
  }

  assertNonNegativeNumber(
    "itemCount",
    delivery.itemCount,
    "Delivery itemCount must be a non-negative number.",
  );

  if (!DELIVERY_STATUSES.includes(delivery.status)) {
    throw new DbValidationError(
      "status",
      "Delivery status must be SENT, SKIPPED, or FAILED.",
    );
  }

  if (delivery.error !== null && typeof delivery.error !== "string") {
    throw new DbValidationError(
      "error",
      "Delivery error must be a string or null.",
    );
  }

  assertTimestamp("NotificationDelivery", "recordedAt", delivery.recordedAt);
  assertSchemaVersion(
    SCHEMA_KEYS.NOTIFICATION_DELIVERIES,
    delivery.schemaVersion,
  );
}

/**
 * Normalizes raw Firestore notification delivery data into the app model.
 *
 * @param id The notification delivery document id.
 * @param delivery The raw Firestore notification delivery data.
 * @returns The normalized notification delivery model.
 */
export function normalizeNotificationDeliveryDocument(
  id: string,
  delivery: FirebaseFirestore.DocumentData,
): NotificationDeliveryModel {
  if (typeof id !== "string" || !id.trim()) {
    throw new DbValidationError(
      "id",
      "Delivery id must be a non-empty string.",
    );
  }

  const migratedDelivery = migrateDocument(
    SCHEMA_KEYS.NOTIFICATION_DELIVERIES,
    delivery,
  );

  assertFirestoreNotificationDelivery(migratedDelivery);

  return {
    id,
    kind: migratedDelivery.kind,
    channel: migratedDelivery.channel,
    teamKey: migratedDelivery.teamKey,
    periodKey: migratedDelivery.periodKey,
    actionItemIds: Array.isArray(migratedDelivery.actionItemIds)
      ? [...migratedDelivery.actionItemIds]
      : [],
    recipientUids: [...migratedDelivery.recipientUids],
    itemCount: migratedDelivery.itemCount,
    status: migratedDelivery.status,
    error: migratedDelivery.error,
    recordedAt: normalizeTimestamp(migratedDelivery.recordedAt),
    schemaVersion: migratedDelivery.schemaVersion,
  };
}

/**
 * Serializes a normalized notification delivery for Firestore storage.
 *
 * @param delivery The normalized notification delivery payload.
 * @returns The Firestore-ready notification delivery document.
 */
export function serializeNotificationDelivery(
  delivery: Omit<NotificationDeliveryModel, "schemaVersion">,
): FirestoreNotificationDelivery {
  return {
    kind: delivery.kind,
    channel: delivery.channel,
    teamKey: delivery.teamKey,
    periodKey: delivery.periodKey,
    actionItemIds: [...delivery.actionItemIds],
    recipientUids: [...delivery.recipientUids],
    itemCount: delivery.itemCount,
    status: delivery.status,
    error: delivery.error,
    recordedAt: Timestamp.fromDate(delivery.recordedAt),
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.NOTIFICATION_DELIVERIES),
  };
}
