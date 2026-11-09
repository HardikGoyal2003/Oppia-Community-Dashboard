"use client";

import { useId } from "react";
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
import { MessagesSquare } from "lucide-react";
import type { DiscussionMetricPoint } from "@/lib/discussion-metrics/discussion-metrics.service";
import { cn } from "@/lib/utils/classnames.utils";

const CHART_GRADIENT_ID_PREFIX = "unanswered-discussions-gradient";

type ChartTooltipPayloadItem = {
  value?: number | string;
  payload?: DiscussionMetricPoint;
};

function formatTickLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function formatTooltipLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function DiscussionChartTooltip({
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
  const value = payload[0]?.value;

  return (
    <div className="min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
        <p className="text-xs font-semibold text-slate-900">
          {capturedAt ? formatTooltipLabel(capturedAt) : "Snapshot"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-sm text-slate-600">Unanswered discussions</span>
        </div>
        <span className="text-sm font-bold text-slate-900">{value}</span>
      </div>
    </div>
  );
}

export function DiscussionsOverTimeChart({
  metrics,
  platformLabel,
  title = "Unanswered Discussions Over Time",
  description,
  className,
}: {
  metrics: DiscussionMetricPoint[];
  platformLabel: string;
  title?: string;
  description?: string;
  className?: string;
}) {
  const resolvedDescription =
    description ?? `Daily unanswered discussion trends for ${platformLabel}.`;
  const gradientId = `${CHART_GRADIENT_ID_PREFIX}-${useId().replace(/:/g, "")}`;

  if (metrics.length === 0) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
          className,
        )}
      >
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{resolvedDescription}</p>
        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12">
          <MessagesSquare className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            No daily discussion metrics captured yet for this platform.
          </p>
        </div>
      </section>
    );
  }

  const chartData = metrics.map((metric) => ({
    capturedAt: metric.capturedAt,
    capturedAtLabel: formatTickLabel(metric.capturedAt),
    unansweredDiscussionsCount: metric.unansweredDiscussionsCount,
  }));

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{resolvedDescription}</p>
      </div>
      <div className="mt-5 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 8, bottom: 8, left: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
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
              width={40}
            />
            <Tooltip content={<DiscussionChartTooltip />} />
            <Area
              type="monotone"
              dataKey="unansweredDiscussionsCount"
              fill={`url(#${gradientId})`}
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="unansweredDiscussionsCount"
              name="Unanswered discussions"
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
    </section>
  );
}
