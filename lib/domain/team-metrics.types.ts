import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type TeamMetricDaily = {
  capturedAt: Date;
  dateKey: string;
  platform: ContributionPlatform;
  teamId: string;
  teamName: string;
  unansweredIssuesCount: number;
};

export type DailyTeamMetric = TeamMetricDaily;
