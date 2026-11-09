"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDisplayValue } from "@/lib/utils/display.utils";
import type { PlatformUnansweredIssuesChartReport } from "../team-reports.types";

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

function getChartTeamLabel(teamName: string): string {
  return teamName
    .replace(/^\[(web|android)\]\s*/i, "")
    .replace(/\s+team\b.*$/i, "")
    .trim();
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
  reports: PlatformUnansweredIssuesChartReport[],
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

function PlatformUnansweredIssuesChartTooltip({
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

function getChartDescription(
  reports: PlatformUnansweredIssuesChartReport[],
): string {
  const platforms = new Set(reports.map((report) => report.platform));

  if (platforms.size === 1) {
    return `Compare unanswered issue counts across all ${formatDisplayValue(
      reports[0].platform,
    )} teams.`;
  }

  return "Compare unanswered issue counts across all teams.";
}

/**
 * Renders one line per team so reviewers can compare backlog movement across a
 * platform or across every team at once.
 */
export function PlatformUnansweredIssuesChart({
  reports,
}: {
  reports: PlatformUnansweredIssuesChartReport[];
}) {
  if (reports.length === 0) {
    return null;
  }

  const chartData = getPlatformChartData(reports);
  const description = getChartDescription(reports);

  if (chartData.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unanswered Issues Over Time
            </h2>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            No daily team metrics captured yet.
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
          <p className="mt-2 text-sm text-slate-600">{description}</p>
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
              <Tooltip content={<PlatformUnansweredIssuesChartTooltip />} />
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
