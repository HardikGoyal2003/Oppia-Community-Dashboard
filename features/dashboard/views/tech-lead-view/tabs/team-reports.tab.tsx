"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getRoleDisplayLabel } from "@/lib/auth/role-display";
import { formatDisplayValue } from "@/lib/utils/display.utils";

type TeamLead = {
  role: "TEAM_LEAD" | "LEAD_TRAINEE";
  uid: string;
  username: string;
};

type TeamReport = {
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

type TeamReportsResponse = {
  generatedAt: string;
  reports: TeamReport[];
};

type ChartTooltipPayloadItem = {
  color?: string;
  name?: string;
  payload?: {
    capturedAt?: string;
  };
  value?: number | string | null;
};

const TEAM_CHART_COLORS = [
  "#2563eb",
  "#06b6d4",
  "#f59e0b",
  "#f43f5e",
  "#10b981",
  "#8b5cf6",
];

const GFI_DOMAIN_COLORS = {
  backend: "#2563eb",
  frontend: "#14b8a6",
  fullstack: "#f59e0b",
  uncategorized: "#94a3b8",
} as const;

function getChartTeamLabel(teamName: string): string {
  return teamName
    .replace(/^\[(web|android)\]\s*/i, "")
    .replace(/\s+team\b.*$/i, "")
    .trim();
}

function getReportTeamLabel(teamName: string): string {
  return getChartTeamLabel(teamName);
}

function formatChartTickLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function formatChartTooltipLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function getPlatformChartData(
  reports: TeamReport[],
): Array<Record<string, number | string | null>> {
  const allCaptureTimes = Array.from(
    new Set(
      reports.flatMap((report) =>
        report.metrics.map((metric) => metric.capturedAt),
      ),
    ),
  ).sort((left, right) => new Date(left).getTime() - new Date(right).getTime());

  return allCaptureTimes.map((capturedAt) => {
    const row: Record<string, number | string | null> = {
      capturedAt,
      capturedAtLabel: formatChartTickLabel(capturedAt),
    };

    for (const report of reports) {
      const metric = report.metrics.find(
        (item) => item.capturedAt === capturedAt,
      );
      row[report.id] = metric?.unansweredIssuesCount ?? null;
    }

    return row;
  });
}

function TeamReportsChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const capturedAt = payload[0]?.payload?.capturedAt;
  const visibleItems = payload.filter(
    (item) => typeof item.value === "number" && item.name,
  );

  return (
    <div className="min-w-52 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-sm font-semibold text-slate-900">
        {capturedAt ? formatChartTooltipLabel(capturedAt) : "Snapshot"}
      </p>
      <div className="mt-2 space-y-2">
        {visibleItems.map((item) => (
          <div
            key={`${item.name}-${item.color}`}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: item.color ?? "#94a3b8" }}
              />
              <span className="text-sm text-slate-700">{item.name}</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformUnansweredIssuesChart({ reports }: { reports: TeamReport[] }) {
  const chartData = getPlatformChartData(reports);

  if (reports.length === 0) {
    return null;
  }

  if (chartData.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unanswered Issues Over Time
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Compare unanswered issue counts across all{" "}
              {formatDisplayValue(reports[0].platform)} teams.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            No daily team metrics captured yet for this platform.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Unanswered Issues Over Time
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Compare unanswered issue counts across all{" "}
            {formatDisplayValue(reports[0].platform)} teams.
          </p>
        </div>
        <p className="text-xs text-slate-500">Last 14 days</p>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 12, bottom: 12, left: 0 }}
            >
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
              <XAxis
                dataKey="capturedAtLabel"
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<TeamReportsChartTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="ml-2 mr-5 inline-block text-sm font-medium text-slate-700">
                    {value}
                  </span>
                )}
                iconType="square"
                wrapperStyle={{ paddingTop: "16px" }}
              />
              {reports.map((report, index) => (
                <Line
                  key={report.id}
                  type="monotone"
                  connectNulls={false}
                  dataKey={report.id}
                  name={getChartTeamLabel(report.teamName)}
                  stroke={TEAM_CHART_COLORS[index % TEAM_CHART_COLORS.length]}
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                  dot={{ r: 3, strokeWidth: 0 }}
                  legendType="square"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function TeamGfiDonutChart({ counts }: { counts: TeamReport["gfiCounts"] }) {
  const data = [
    {
      color: GFI_DOMAIN_COLORS.frontend,
      key: "frontend",
      label: "Frontend",
      value: counts.frontend,
    },
    {
      color: GFI_DOMAIN_COLORS.backend,
      key: "backend",
      label: "Backend",
      value: counts.backend,
    },
    {
      color: GFI_DOMAIN_COLORS.fullstack,
      key: "fullstack",
      label: "Fullstack",
      value: counts.fullstack,
    },
    {
      color: GFI_DOMAIN_COLORS.uncategorized,
      key: "uncategorized",
      label: "Uncategorized",
      value: counts.uncategorized,
    },
  ];
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData =
    total === 0
      ? [{ color: "#e2e8f0", key: "empty", label: "No GFIs", value: 1 }]
      : data;

  return (
    <div className="grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
      <div className="mx-auto h-52 w-full max-w-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={58}
              outerRadius={84}
              paddingAngle={total === 0 ? 0 : 3}
              strokeWidth={0}
            >
              {chartData.map((item) => (
                <Cell key={item.key} fill={item.color} />
              ))}
            </Pie>
            <text
              x="50%"
              y="47%"
              textAnchor="middle"
              className="fill-slate-400 text-[11px] uppercase tracking-[0.16em]"
            >
              Total GFIs
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              className="fill-slate-900 text-[28px] font-semibold"
            >
              {total}
            </text>
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {data.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-sm font-medium text-slate-700">
                  {item.label}
                </p>
                {item.key !== "uncategorized" && item.value < 5 && (
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <AlertTriangle
                          className="h-4 w-4 text-red-500"
                          aria-label={`${item.label} has fewer than 5 good first issues`}
                        />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Each domain should have at least 5 good first issues.
                      </p>
                    </TooltipContent>
                  </UiTooltip>
                )}
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamReportsTab() {
  const [reports, setReports] = useState<TeamReport[]>([]);
  const [platform, setPlatform] = useState<ContributionPlatform>("WEB");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReports() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/team-reports", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load team reports.");
        }

        const data = (await response.json()) as TeamReportsResponse;
        setReports(data.reports);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load team reports.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadReports();
  }, []);

  if (loading) {
    return <p className="p-6">Loading team reports...</p>;
  }

  if (errorMessage) {
    return <p className="p-6 text-sm text-red-600">{errorMessage}</p>;
  }

  const filteredReports = reports.filter(
    (report) => report.platform === platform,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Team Reports</h1>
        <p className="mt-2 text-sm text-slate-600">
          Compare unanswered issue trends, current GFI coverage, and team lead
          presence across all teams.
        </p>
      </div>

      <div className="flex gap-2">
        {(["WEB", "ANDROID"] as ContributionPlatform[]).map((option) => (
          <button
            key={option}
            className={`rounded border px-3 py-1 text-sm ${
              platform === option
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-300 bg-white text-gray-700"
            }`}
            onClick={() => setPlatform(option)}
          >
            {formatDisplayValue(option)}
          </button>
        ))}
      </div>

      <PlatformUnansweredIssuesChart reports={filteredReports} />

      <div className="grid gap-4 2xl:grid-cols-2">
        {filteredReports.map((report) => (
          <section
            key={report.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {getReportTeamLabel(report.teamName)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Last sync:{" "}
                  {new Date(report.lastUpdated).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="space-y-6 px-6 py-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  GFI Breakdown
                </h3>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <TeamGfiDonutChart counts={report.gfiCounts} />
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[1.05fr_1.4fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Leads
                  </h3>
                  <div className="mt-3 space-y-2">
                    {report.leads.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
                        No leads synced for this team yet.
                      </p>
                    ) : (
                      report.leads.map((lead) => (
                        <div
                          key={lead.uid}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium text-slate-900">
                              @{lead.username}
                            </p>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                              {getRoleDisplayLabel(lead.role)}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Next Steps
                  </h3>
                  <div className="mt-3 space-y-2">
                    {report.nextSteps.length === 0 ? (
                      <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                        No immediate action flagged for this team.
                      </p>
                    ) : (
                      report.nextSteps.map((step, index) => (
                        <div
                          key={step.message}
                          className={`flex gap-3 rounded-xl px-3 py-3 ${
                            step.priority === "high"
                              ? "border border-red-300 bg-white"
                              : "border border-amber-200 bg-white"
                          }`}
                        >
                          <div
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              step.priority === "high"
                                ? "bg-red-200 text-red-900"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-slate-800">
                              {step.message}
                            </p>
                            <p className="text-xs leading-5 text-slate-500">
                              {step.reason}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>

      {filteredReports.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500">
          No team reports available for {formatDisplayValue(platform)} yet.
        </p>
      )}
    </div>
  );
}
