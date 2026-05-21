"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { TeamReport } from "../overview.types";
import { GFI_DOMAIN_COLORS } from "../overview.utils";

export function TeamLeadGfiDonutSection({
  counts,
}: {
  counts: TeamReport["gfiCounts"];
}) {
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
  ] as const;
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const chartData =
    total === 0
      ? [{ color: "#e2e8f0", key: "empty", label: "No GFIs", value: 1 }]
      : data;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="mx-auto h-52 w-full max-w-[220px] shrink-0">
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

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: item.color }}
                />
                <p className="truncate text-sm font-medium text-slate-700">
                  {item.label}
                </p>
                {item.key !== "uncategorized" && item.value < 5 && (
                  <UiTooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <AlertTriangle
                          className="h-4 w-4 shrink-0 text-red-500"
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
              <p className="shrink-0 text-lg font-semibold text-slate-900">
                {item.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
