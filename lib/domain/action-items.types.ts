import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * Lifecycle of a tracked action item. The status is derived by the sync engine
 * from the rule's firing state — no human writes it:
 *
 * - OPEN: the rule is currently firing and the team still has to act on it.
 * - RESOLVED: the rule fell silent past the stale threshold, so the item
 *   closed itself.
 */
export type ActionItemStatus = "OPEN" | "RESOLVED";

export type ActionItemPriority = "high" | "medium";

/** Statuses that still require follow-up and therefore appear in digests. */
export const ACTION_ITEM_ACTIVE_STATUSES: readonly ActionItemStatus[] = [
  "OPEN",
] as const;

/**
 * Days an item's rule must stay silent before the item resolves itself. The
 * same threshold separates a rule that is still firing from one that healed.
 */
export const ACTION_ITEM_RESOLVE_AFTER_DAYS = 7;

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
  /** When the item resolved itself after the rule fell silent. */
  resolvedAt: Date | null;
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
  resolvedCount: number;
  activeCount: number;
  syncedAt: string;
};
