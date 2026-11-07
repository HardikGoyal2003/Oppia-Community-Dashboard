export type ActionItemPriority = "high" | "medium" | "low";

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
  ruleKey: string;
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
