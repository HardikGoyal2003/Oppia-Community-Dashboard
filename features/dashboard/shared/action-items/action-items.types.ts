export type ActionItemStatus =
  | "OPEN"
  | "ACKNOWLEDGED"
  | "RESOLVED"
  | "DISMISSED";

/** Statuses a reviewer can set through the API. */
export type ActionItemReviewStatus = Exclude<ActionItemStatus, "OPEN">;

/**
 * Client-side action item shape. Mirrors the API model with dates serialized
 * as ISO strings by JSON.
 */
export type ActionItem = {
  id: string;
  teamId: string;
  teamKey: string;
  teamName: string;
  platform: "WEB" | "ANDROID";
  ruleKey: string;
  params: string | null;
  message: string;
  priority: "high" | "medium";
  reason: string;
  status: ActionItemStatus;
  detectedAt: string;
  lastDetectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  notificationCount: number;
  escalationLevel: number;
  lastEscalatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionItemsSyncSummary = {
  detectedCount: number;
  createdCount: number;
  updatedCount: number;
  reopenedCount: number;
  activeCount: number;
  syncedAt: string;
};

export type ActionItemsResponse = {
  items: ActionItem[];
  sync?: ActionItemsSyncSummary;
  generatedAt: string;
};

export type ReviewActionItemResponse = {
  item: ActionItem;
};
