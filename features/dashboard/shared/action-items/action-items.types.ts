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
  message: string;
  priority: "high" | "medium";
  reason: string;
  detectedAt: string;
  lastDetectedAt: string;
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
  deletedCount: number;
  currentCount: number;
  syncedAt: string;
};

export type ActionItemsResponse = {
  items: ActionItem[];
  sync?: ActionItemsSyncSummary;
  generatedAt: string;
};
