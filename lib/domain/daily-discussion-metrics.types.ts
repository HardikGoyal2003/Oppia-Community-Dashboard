import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

export type DailyDiscussionMetric = SchemaVersioned & {
  capturedAt: Date;
  dateKey: string;
  platform: ContributionPlatform;
  unansweredDiscussionsCount: number;
};
