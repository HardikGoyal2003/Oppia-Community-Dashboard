import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type {
  ActionItemModel,
  ActionItemPriority,
  ActionItemStatus,
} from "@/lib/domain/action-items.types";
import {
  assertOptionalTimestamp,
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

/** Action item fields that are stored as Firestore Timestamps. */
type TimestampedActionItemFields = {
  detectedAt: Timestamp;
  lastDetectedAt: Timestamp;
  acknowledgedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  firstNotifiedAt: Timestamp | null;
  lastNotifiedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type FirestoreActionItem = Omit<
  ActionItemModel,
  keyof TimestampedActionItemFields
> &
  TimestampedActionItemFields;

export type ActionItemStatusUpdate = {
  status: ActionItemModel["status"];
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  updatedAt: Date;
};

export type FirestoreActionItemStatusUpdate = {
  status: ActionItemStatus;
  acknowledgedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  updatedAt: Timestamp;
};

export type FirestoreActionItemNotificationUpdate = {
  firstNotifiedAt: Timestamp;
  lastNotifiedAt: Timestamp;
  notificationCount: number;
};

const ACTION_ITEM_STATUSES: readonly ActionItemStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
  "RESOLVED",
  "DISMISSED",
];

const ACTION_ITEM_PRIORITIES: readonly ActionItemPriority[] = [
  "high",
  "medium",
];

/**
 * Validates that a field is a non-empty string.
 *
 * @param value The string candidate.
 * @param field The Firestore field name being validated.
 * @returns Nothing. Throws when the value is not a non-empty string.
 */
function assertNonEmptyString(
  value: string,
  field: string,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DbValidationError(field, `${field} must be a non-empty string.`);
  }
}

/**
 * Validates that a numeric field is present and non-negative.
 *
 * @param value The numeric field candidate.
 * @param field The Firestore field name being validated.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertNonNegativeNumber(
  value: number | undefined,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new DbValidationError(
      field,
      `${field} must be a non-negative number.`,
    );
  }
}

/**
 * Validates the raw Firestore action item document shape.
 *
 * @param item The raw Firestore action item data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreActionItem(
  item: FirebaseFirestore.DocumentData,
): asserts item is FirestoreActionItem {
  assertNonEmptyString(item.id, "id");
  assertNonEmptyString(item.teamId, "teamId");
  assertNonEmptyString(item.teamKey, "teamKey");
  assertNonEmptyString(item.teamName, "teamName");

  if (item.platform !== "WEB" && item.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Action item platform must be WEB or ANDROID.",
    );
  }

  assertNonEmptyString(item.ruleKey, "ruleKey");

  if (item.params !== null && typeof item.params !== "string") {
    throw new DbValidationError(
      "params",
      "Action item params must be a string or null.",
    );
  }

  assertNonEmptyString(item.message, "message");
  assertNonEmptyString(item.reason, "reason");

  if (!ACTION_ITEM_PRIORITIES.includes(item.priority)) {
    throw new DbValidationError(
      "priority",
      "Action item priority must be high or medium.",
    );
  }

  if (!ACTION_ITEM_STATUSES.includes(item.status)) {
    throw new DbValidationError(
      "status",
      "Action item status must be OPEN, ACKNOWLEDGED, RESOLVED, or DISMISSED.",
    );
  }

  assertNonNegativeNumber(item.notificationCount, "notificationCount");

  if (item.resolvedBy !== null) {
    assertNonEmptyString(item.resolvedBy, "resolvedBy");
  }

  if (item.resolutionNote !== null && typeof item.resolutionNote !== "string") {
    throw new DbValidationError(
      "resolutionNote",
      "Action item resolutionNote must be a string or null.",
    );
  }

  assertTimestamp("ActionItem", "detectedAt", item.detectedAt);
  assertTimestamp("ActionItem", "lastDetectedAt", item.lastDetectedAt);
  assertOptionalTimestamp("ActionItem", "acknowledgedAt", item.acknowledgedAt);
  assertOptionalTimestamp("ActionItem", "resolvedAt", item.resolvedAt);
  assertOptionalTimestamp(
    "ActionItem",
    "firstNotifiedAt",
    item.firstNotifiedAt,
  );
  assertOptionalTimestamp("ActionItem", "lastNotifiedAt", item.lastNotifiedAt);
  assertTimestamp("ActionItem", "createdAt", item.createdAt);
  assertTimestamp("ActionItem", "updatedAt", item.updatedAt);
}

/**
 * Normalizes raw Firestore action item data into the app model.
 *
 * @param item The raw Firestore action item data with its id.
 * @returns The normalized action item model.
 */
export function normalizeActionItemDocument(
  item: FirebaseFirestore.DocumentData & { id: string },
): ActionItemModel {
  // Assert before destructuring: the assertion validates the id field too.
  assertFirestoreActionItem(item);

  const { id, ...rawItem } = item;

  return {
    id,
    teamId: rawItem.teamId,
    teamKey: rawItem.teamKey,
    teamName: rawItem.teamName,
    platform: rawItem.platform,
    ruleKey: rawItem.ruleKey,
    params: rawItem.params,
    message: rawItem.message,
    priority: rawItem.priority,
    reason: rawItem.reason,
    status: rawItem.status,
    detectedAt: normalizeTimestamp(rawItem.detectedAt),
    lastDetectedAt: normalizeTimestamp(rawItem.lastDetectedAt),
    acknowledgedAt: rawItem.acknowledgedAt
      ? normalizeTimestamp(rawItem.acknowledgedAt)
      : null,
    resolvedAt: rawItem.resolvedAt
      ? normalizeTimestamp(rawItem.resolvedAt)
      : null,
    resolvedBy: rawItem.resolvedBy,
    resolutionNote: rawItem.resolutionNote,
    firstNotifiedAt: rawItem.firstNotifiedAt
      ? normalizeTimestamp(rawItem.firstNotifiedAt)
      : null,
    lastNotifiedAt: rawItem.lastNotifiedAt
      ? normalizeTimestamp(rawItem.lastNotifiedAt)
      : null,
    notificationCount: rawItem.notificationCount,
    createdAt: normalizeTimestamp(rawItem.createdAt),
    updatedAt: normalizeTimestamp(rawItem.updatedAt),
  };
}

/**
 * Serializes a normalized action item for Firestore storage.
 *
 * @param item The normalized action item payload.
 * @returns The Firestore-ready action item document.
 */
export function serializeActionItem(
  item: ActionItemModel,
): FirestoreActionItem {
  return {
    id: item.id,
    teamId: item.teamId,
    teamKey: item.teamKey,
    teamName: item.teamName,
    platform: item.platform,
    ruleKey: item.ruleKey,
    params: item.params,
    message: item.message,
    priority: item.priority,
    reason: item.reason,
    status: item.status,
    detectedAt: Timestamp.fromDate(item.detectedAt),
    lastDetectedAt: Timestamp.fromDate(item.lastDetectedAt),
    acknowledgedAt: item.acknowledgedAt
      ? Timestamp.fromDate(item.acknowledgedAt)
      : null,
    resolvedAt: item.resolvedAt ? Timestamp.fromDate(item.resolvedAt) : null,
    resolvedBy: item.resolvedBy,
    resolutionNote: item.resolutionNote,
    firstNotifiedAt: item.firstNotifiedAt
      ? Timestamp.fromDate(item.firstNotifiedAt)
      : null,
    lastNotifiedAt: item.lastNotifiedAt
      ? Timestamp.fromDate(item.lastNotifiedAt)
      : null,
    notificationCount: item.notificationCount,
    createdAt: Timestamp.fromDate(item.createdAt),
    updatedAt: Timestamp.fromDate(item.updatedAt),
  };
}

/**
 * Serializes a status-transition patch for a partial action item update.
 *
 * @param update The normalized status update payload.
 * @returns The Firestore-ready partial update document.
 */
export function serializeActionItemStatusUpdate(
  update: ActionItemStatusUpdate,
): FirestoreActionItemStatusUpdate {
  return {
    status: update.status,
    acknowledgedAt: update.acknowledgedAt
      ? Timestamp.fromDate(update.acknowledgedAt)
      : null,
    resolvedAt: update.resolvedAt
      ? Timestamp.fromDate(update.resolvedAt)
      : null,
    resolvedBy: update.resolvedBy,
    resolutionNote: update.resolutionNote,
    updatedAt: Timestamp.fromDate(update.updatedAt),
  };
}

/**
 * Serializes the notification bookkeeping patch for action items after a digest.
 *
 * @param previousFirstNotifiedAt The item's existing first notification time.
 * @param notifiedAt The current notification time.
 * @param nextNotificationCount The incremented notification counter.
 * @returns The Firestore-ready partial update document.
 */
export function serializeActionItemNotificationUpdate(
  previousFirstNotifiedAt: Date | null,
  notifiedAt: Date,
  nextNotificationCount: number,
): FirestoreActionItemNotificationUpdate {
  return {
    firstNotifiedAt: Timestamp.fromDate(previousFirstNotifiedAt ?? notifiedAt),
    lastNotifiedAt: Timestamp.fromDate(notifiedAt),
    notificationCount: nextNotificationCount,
  };
}
