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
  lastEscalatedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

/**
 * Persisted shape of an action item document. The document id (the rule key)
 * and the parent team id live in the Firestore path, not in the document body.
 */
export type FirestoreActionItem = Omit<
  ActionItemModel,
  "id" | "teamId" | keyof TimestampedActionItemFields
> &
  TimestampedActionItemFields;

export type ActionItemStatusUpdate = {
  status: ActionItemModel["status"];
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
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

export type FirestoreActionItemEscalationUpdate = {
  escalationLevel: number;
  lastEscalatedAt: Timestamp;
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
  assertNonNegativeNumber(item.escalationLevel, "escalationLevel");

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
  assertOptionalTimestamp(
    "ActionItem",
    "lastEscalatedAt",
    item.lastEscalatedAt,
  );
  assertTimestamp("ActionItem", "createdAt", item.createdAt);
  assertTimestamp("ActionItem", "updatedAt", item.updatedAt);
}

/**
 * Normalizes a raw Firestore action item document into the app model.
 *
 * @param params The document id (rule key), parent team id, and raw data.
 * @returns The normalized action item model.
 * @throws {DbValidationError} When the document shape is invalid.
 */
export function normalizeActionItemDocument(params: {
  id: string;
  teamId: string;
  data: FirebaseFirestore.DocumentData;
}): ActionItemModel {
  const { id, teamId, data } = params;

  assertNonEmptyString(id, "id");
  assertNonEmptyString(teamId, "teamId");
  assertFirestoreActionItem(data);

  return {
    id,
    teamId,
    teamKey: data.teamKey,
    teamName: data.teamName,
    platform: data.platform,
    ruleKey: data.ruleKey,
    params: data.params,
    message: data.message,
    priority: data.priority,
    reason: data.reason,
    status: data.status,
    detectedAt: normalizeTimestamp(data.detectedAt),
    lastDetectedAt: normalizeTimestamp(data.lastDetectedAt),
    acknowledgedAt: data.acknowledgedAt
      ? normalizeTimestamp(data.acknowledgedAt)
      : null,
    resolvedAt: data.resolvedAt ? normalizeTimestamp(data.resolvedAt) : null,
    resolvedBy: data.resolvedBy,
    resolutionNote: data.resolutionNote,
    firstNotifiedAt: data.firstNotifiedAt
      ? normalizeTimestamp(data.firstNotifiedAt)
      : null,
    lastNotifiedAt: data.lastNotifiedAt
      ? normalizeTimestamp(data.lastNotifiedAt)
      : null,
    notificationCount: data.notificationCount,
    escalationLevel: data.escalationLevel,
    lastEscalatedAt: data.lastEscalatedAt
      ? normalizeTimestamp(data.lastEscalatedAt)
      : null,
    createdAt: normalizeTimestamp(data.createdAt),
    updatedAt: normalizeTimestamp(data.updatedAt),
  };
}

/**
 * Serializes a normalized action item for Firestore storage. The document id
 * is intentionally omitted — it lives in the document path.
 *
 * @param item The normalized action item payload.
 * @returns The Firestore-ready action item document.
 */
export function serializeActionItem(
  item: ActionItemModel,
): FirestoreActionItem {
  return {
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
    escalationLevel: item.escalationLevel,
    lastEscalatedAt: item.lastEscalatedAt
      ? Timestamp.fromDate(item.lastEscalatedAt)
      : null,
    createdAt: Timestamp.fromDate(item.createdAt),
    updatedAt: Timestamp.fromDate(item.updatedAt),
  };
}

/**
 * Serializes a status-transition patch for a partial action item update.
 *
 * @param update The normalized status update payload.
 * @param updatedAt The time of the transition.
 * @returns The Firestore-ready partial update document.
 */
export function serializeActionItemStatusUpdate(
  update: ActionItemStatusUpdate,
  updatedAt: Date,
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
    updatedAt: Timestamp.fromDate(updatedAt),
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

/**
 * Serializes the escalation bookkeeping patch for action items after a nudge.
 *
 * @param escalationLevel The new escalation level.
 * @param escalatedAt The time the nudge was sent.
 * @returns The Firestore-ready partial update document.
 */
export function serializeActionItemEscalationUpdate(
  escalationLevel: number,
  escalatedAt: Date,
): FirestoreActionItemEscalationUpdate {
  return {
    escalationLevel,
    lastEscalatedAt: Timestamp.fromDate(escalatedAt),
  };
}
