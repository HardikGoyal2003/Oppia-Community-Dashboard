"use client";

import {
  Area,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";
import type { TeamReport } from "../overview.types";
import { CHART_GRADIENT_ID, formatChartTickLabel } from "../overview.utils";
import { TeamOverviewChartTooltip } from "./team-overview-chart-tooltip";

export function TeamOverviewUnansweredIssuesChart({
  metrics,
}: {
  metrics: TeamReport["metrics"];
}) {
  if (metrics.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12">
        <TrendingUp className="mb-3 h-8 w-8 text-slate-300" />
        <p className="text-sm text-slate-500">
          No daily metrics captured yet for this team.
        </p>
      </div>
    );
  }

  const chartData = metrics.map((metric) => ({
    capturedAt: metric.capturedAt,
    capturedAtLabel: formatChartTickLabel(metric.capturedAt),
    unansweredIssuesCount: metric.unansweredIssuesCount,
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 12, right: 8, bottom: 8, left: -16 }}
        >
          <defs>
            <linearGradient id={CHART_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#e2e8f0"
            strokeDasharray="4 4"
            vertical={false}
          />
          <XAxis
            dataKey="capturedAtLabel"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={30}
          />
          <Tooltip content={<TeamOverviewChartTooltip />} />
          <Area
            type="monotone"
            dataKey="unansweredIssuesCount"
            fill={`url(#${CHART_GRADIENT_ID})`}
            stroke="none"
          />
          <Line
            type="monotone"
            dataKey="unansweredIssuesCount"
            name="Unanswered issues"
            stroke="#2563eb"
            strokeWidth={2.5}
            activeDot={{
              r: 5,
              stroke: "#fff",
              strokeWidth: 2,
              fill: "#2563eb",
            }}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
