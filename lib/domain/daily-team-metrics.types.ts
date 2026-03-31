import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type DailyTeamMetric = {
  capturedAt: Date;
  dateKey: string;
  platform: ContributionPlatform;
  teamId: string;
  teamName: string;
  unansweredIssuesCount: number;
};
