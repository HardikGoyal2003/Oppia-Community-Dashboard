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
 * A persisted action item derived from a team report rule. The document id is
 * deterministic (`${teamKey}__${ruleKey}`) so repeated syncs upsert instead of
 * duplicating.
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
