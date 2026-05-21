"use client";

import type { ChartTooltipPayloadItem } from "../overview.types";
import { formatChartTooltipLabel } from "../overview.utils";

export function TeamOverviewChartTooltip({
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
          {capturedAt ? formatChartTooltipLabel(capturedAt) : "Snapshot"}
        </p>
      </div>
      <div className="flex items-center justify-between gap-6 px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          <span className="text-sm text-slate-600">Unanswered issues</span>
        </div>
        <span className="text-sm font-bold text-slate-900">{value}</span>
      </div>
    </div>
  );
}
