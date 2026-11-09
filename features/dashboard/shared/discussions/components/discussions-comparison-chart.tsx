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
import { MessagesSquare } from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DiscussionMetricPoint } from "@/lib/discussion-metrics/discussion-metrics.service";
import { cn } from "@/lib/utils/classnames.utils";

type ComparisonSeries = {
  platform: ContributionPlatform;
  metrics: DiscussionMetricPoint[];
};

type MergedRow = {
  dateKey: string;
  capturedAt: string;
  capturedAtLabel: string;
  WEB: number | null;
  ANDROID: number | null;
};

type ComparisonTooltipPayloadItem = {
  color?: string;
  name?: string;
  payload?: MergedRow;
  value?: number | string | null;
};

const SERIES_META: Record<
  ContributionPlatform,
  { label: string; color: string }
> = {
  WEB: { label: "Web", color: "#2563eb" },
  ANDROID: { label: "Android", color: "#f59e0b" },
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

function mergeSeries(series: ComparisonSeries[]): MergedRow[] {
  const dateKeys = Array.from(
    new Set(
      series.flatMap((item) => item.metrics.map((metric) => metric.dateKey)),
    ),
  ).sort();

  return dateKeys.map((dateKey) => {
    const webMetric = series
      .find((item) => item.platform === "WEB")
      ?.metrics.find((metric) => metric.dateKey === dateKey);
    const androidMetric = series
      .find((item) => item.platform === "ANDROID")
      ?.metrics.find((metric) => metric.dateKey === dateKey);

    const capturedAt = webMetric?.capturedAt ?? androidMetric?.capturedAt ?? "";

    return {
      dateKey,
      capturedAt,
      capturedAtLabel: capturedAt ? formatTickLabel(capturedAt) : dateKey,
      WEB: webMetric?.unansweredDiscussionsCount ?? null,
      ANDROID: androidMetric?.unansweredDiscussionsCount ?? null,
    };
  });
}

function DiscussionComparisonTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ComparisonTooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const capturedAt = payload[0]?.payload?.capturedAt;
  const visibleItems = payload.filter(
    (item) =>
      typeof item.value === "number" && item.name && item.value !== null,
  );

  return (
    <div className="min-w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50 px-3.5 py-2">
        <p className="text-xs font-semibold text-slate-900">
          {capturedAt ? formatTooltipLabel(capturedAt) : "Snapshot"}
        </p>
      </div>
      <div className="space-y-2 px-3.5 py-2.5">
        {visibleItems.map((item) => (
          <div
            key={`${item.name}-${item.color}`}
            className="flex items-center justify-between gap-6"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color ?? "#94a3b8" }}
              />
              <span className="text-sm text-slate-600">{item.name}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Plots both platform discussion trends on one chart so admins can compare them
 * at a glance.
 */
export function DiscussionsComparisonChart({
  series,
  title = "Unanswered Discussions Over Time",
  description,
  className,
}: {
  series: ComparisonSeries[];
  title?: string;
  description?: string;
  className?: string;
}) {
  const chartData = mergeSeries(series);
  const hasData = chartData.length > 0;

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">
          {description ??
            "Daily unanswered discussion trends for web and android."}
        </p>
      </div>

      {!hasData ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12">
          <MessagesSquare className="mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-500">
            No daily discussion metrics captured yet for either platform.
          </p>
        </div>
      ) : (
        <div className="mt-5 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 12, right: 8, bottom: 8, left: 0 }}
            >
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
              <Tooltip content={<DiscussionComparisonTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="ml-2 mr-5 inline-block text-sm font-medium text-slate-700">
                    {value}
                  </span>
                )}
                iconType="circle"
                wrapperStyle={{ paddingTop: "16px" }}
              />
              {series.map((item) => (
                <Line
                  key={item.platform}
                  type="monotone"
                  connectNulls={false}
                  dataKey={item.platform}
                  name={SERIES_META[item.platform].label}
                  stroke={SERIES_META[item.platform].color}
                  strokeWidth={2.5}
                  activeDot={{
                    r: 5,
                    stroke: "#fff",
                    strokeWidth: 2,
                    fill: SERIES_META[item.platform].color,
                  }}
                  dot={false}
                  legendType="circle"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
