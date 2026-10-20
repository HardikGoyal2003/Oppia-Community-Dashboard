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
  status: "OPEN" | "RESOLVED";
  detectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
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
  resolvedCount: number;
  activeCount: number;
  syncedAt: string;
};

export type ActionItemsResponse = {
  items: ActionItem[];
  sync?: ActionItemsSyncSummary;
  generatedAt: string;
};
