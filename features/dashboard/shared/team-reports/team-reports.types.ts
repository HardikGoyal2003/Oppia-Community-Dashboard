import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * The minimal team-report shape required to render the platform-wide
 * unanswered-issues chart.
 */
export type PlatformUnansweredIssuesChartReport = {
  id: string;
  teamName: string;
  platform: ContributionPlatform;
  metrics: Array<{
    capturedAt: string;
    unansweredIssuesCount: number;
  }>;
};

export type TeamReportsResponse = {
  generatedAt: string;
  reports: PlatformUnansweredIssuesChartReport[];
};
