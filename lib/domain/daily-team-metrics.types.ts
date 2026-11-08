import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

export type DailyTeamMetric = SchemaVersioned & {
  capturedAt: Date;
  dateKey: string;
  maxWaitingDays: number;
  platform: ContributionPlatform;
  teamId: string;
  teamName: string;
  unansweredIssuesCount: number;
};
