import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * Lifecycle of a tracked action item.
 *
 * - OPEN: detected and waiting for a team lead to act.
 * - ACKNOWLEDGED: a lead confirmed they are working on it.
 * - RESOLVED: a lead (or admin) marked the item done.
 * - DISMISSED: a lead (or admin) decided the item does not apply.
 */
export type ActionItemStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "DISMISSED";

export type ActionItemPriority = "high" | "medium";

/** Statuses that still require follow-up and therefore appear in digests. */
export const ACTION_ITEM_ACTIVE_STATUSES: readonly ActionItemStatus[] = [
  "OPEN",
  "ACKNOWLEDGED",
] as const;

/** Statuses a reviewer may set through the API (everything except reopening). */
export type ActionItemReviewStatus = "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

/**
 * Items undetected for this long are treated as probably-fixed: digests group
 * them under "confirm and close" and escalation never nudges about them.
 */
export const ACTION_ITEM_STALE_AFTER_DAYS = 7;

/**
 * A persisted action item derived from a team report rule, stored as
 * `teams/{teamId}/actionItems/{ruleKey}`. The document id is the stable rule
 * key, so repeated syncs upsert instead of duplicating.
 */
export type ActionItemModel = {
  id: string;
  /** Team document id such as `WEB_CORE`. */
  teamId: string;
  /** Team key stored on user records such as `CORE`. */
  teamKey: string;
  teamName: string;
  platform: ContributionPlatform;
  ruleKey: string;
  params: string | null;
  message: string;
  priority: ActionItemPriority;
  reason: string;
  status: ActionItemStatus;
  /** When the rule was first detected for this id. */
  detectedAt: Date;
  /** When the rule was last observed firing (stays put after the rule heals). */
  lastDetectedAt: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  /** uid of the user who resolved or dismissed the item. */
  resolvedBy: string | null;
  resolutionNote: string | null;
  firstNotifiedAt: Date | null;
  lastNotifiedAt: Date | null;
  notificationCount: number;
  /** How many escalation nudges have been sent for this item (0 = never). */
  escalationLevel: number;
  /** When the most recent escalation nudge was sent; null until first nudged. */
  lastEscalatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Summary returned by the action-item sync engine. */
export type ActionItemSyncSummary = {
  detectedCount: number;
  createdCount: number;
  updatedCount: number;
  reopenedCount: number;
  activeCount: number;
  syncedAt: string;
};
