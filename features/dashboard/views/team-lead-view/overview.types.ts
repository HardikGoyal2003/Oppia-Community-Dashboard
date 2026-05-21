export type TeamLead = {
  role: "TEAM_LEAD" | "LEAD_TRAINEE";
  uid: string;
  username: string;
};

export type TeamReport = {
  id: string;
  gfiCounts: {
    backend: number;
    frontend: number;
    fullstack: number;
    uncategorized: number;
  };
  lastUpdated: string | Date;
  leads: TeamLead[];
  metrics: Array<{
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: Array<{
    message: string;
    priority: "high" | "medium";
    reason: string;
  }>;
  platform: "WEB" | "ANDROID";
  teamName: string;
};

export type TeamLeadOverviewResponse = {
  report: TeamReport;
};

export type ChartTooltipPayloadItem = {
  color?: string;
  name?: string;
  payload?: {
    capturedAt?: string;
  };
  value?: number | string | null;
};

export type StatCardData = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  description?: string;
  trend: { direction: "up" | "down" | "flat"; delta: number } | null;
  showTrend?: number | null;
  dataPoints?: TeamReport["metrics"];
  metricCount?: number;
};

export type StatusSummary = {
  badgeClassName: string;
  description: string;
  label: string;
};

export type StatusVariant = {
  dot: string;
  ring: string;
};

export type PerformanceMetric = TeamReport["metrics"][number];
