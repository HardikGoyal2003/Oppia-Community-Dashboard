import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type ActionItemPriority = "high" | "medium";

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
  /** When the current rule instance was first detected. */
  detectedAt: Date;
  /** When the rule was most recently observed in the report. */
  lastDetectedAt: Date;
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
  deletedCount: number;
  currentCount: number;
  syncedAt: string;
};
