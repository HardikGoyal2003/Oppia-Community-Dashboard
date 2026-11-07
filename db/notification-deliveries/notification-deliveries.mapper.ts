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

export type FirestoreNotificationDelivery = Omit<
  NotificationDeliveryModel,
  "recordedAt"
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
  if (typeof delivery.id !== "string" || !delivery.id.trim()) {
    throw new DbValidationError(
      "id",
      "Delivery id must be a non-empty string.",
    );
  }

  if (typeof delivery.kind !== "string" || !delivery.kind.trim()) {
    throw new DbValidationError(
      "kind",
      "Delivery kind must be a non-empty string.",
    );
  }

  if (!NOTIFICATION_CHANNELS.includes(delivery.channel)) {
    throw new DbValidationError(
      "channel",
      "Delivery channel must be EMAIL or IN_APP.",
    );
  }

  if (typeof delivery.teamKey !== "string" || !delivery.teamKey.trim()) {
    throw new DbValidationError(
      "teamKey",
      "Delivery teamKey must be a non-empty string.",
    );
  }

  if (typeof delivery.periodKey !== "string" || !delivery.periodKey.trim()) {
    throw new DbValidationError(
      "periodKey",
      "Delivery periodKey must be a non-empty string.",
    );
  }

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

  if (
    typeof delivery.itemCount !== "number" ||
    Number.isNaN(delivery.itemCount) ||
    delivery.itemCount < 0
  ) {
    throw new DbValidationError(
      "itemCount",
      "Delivery itemCount must be a non-negative number.",
    );
  }

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
}

/**
 * Normalizes raw Firestore notification delivery data into the app model.
 *
 * @param delivery The raw Firestore notification delivery data with its id.
 * @returns The normalized notification delivery model.
 */
export function normalizeNotificationDeliveryDocument(
  delivery: FirebaseFirestore.DocumentData & { id: string },
): NotificationDeliveryModel {
  // Assert before destructuring: the assertion validates the id field too.
  assertFirestoreNotificationDelivery(delivery);

  const { id, ...rawDelivery } = delivery;

  return {
    id,
    kind: rawDelivery.kind,
    channel: rawDelivery.channel,
    teamKey: rawDelivery.teamKey,
    periodKey: rawDelivery.periodKey,
    actionItemIds: Array.isArray(rawDelivery.actionItemIds)
      ? [...rawDelivery.actionItemIds]
      : [],
    recipientUids: [...rawDelivery.recipientUids],
    itemCount: rawDelivery.itemCount,
    status: rawDelivery.status,
    error: rawDelivery.error,
    recordedAt: normalizeTimestamp(rawDelivery.recordedAt),
  };
}

/**
 * Serializes a normalized notification delivery for Firestore storage.
 *
 * @param delivery The normalized notification delivery payload.
 * @returns The Firestore-ready notification delivery document.
 */
export function serializeNotificationDelivery(
  delivery: NotificationDeliveryModel,
): FirestoreNotificationDelivery {
  return {
    id: delivery.id,
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
  };
}
