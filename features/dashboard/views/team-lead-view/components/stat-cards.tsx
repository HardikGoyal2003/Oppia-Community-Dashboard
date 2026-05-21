"use client";

import { ArrowUpRight } from "lucide-react";
import type { StatCardData } from "../overview.types";
import { STAT_CARD_STYLES } from "../overview.utils";

export function StatCards({
  statCards,
  lastSyncTime,
}: {
  statCards: StatCardData[];
  lastSyncTime: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {statCards.map((stat, index) => {
        const styles = STAT_CARD_STYLES[index]!;
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${styles.accent}`}
            />
            <div className="flex items-center justify-between">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${styles.bg}`}
              >
                <Icon className={`h-4.5 w-4.5 ${styles.icon}`} />
              </div>
              {(() => {
                const t = stat.trend as
                  | { direction: "up" | "down" | "flat"; delta: number }
                  | null
                  | undefined;
                if (!t) return null;
                return (
                  <span
                    className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                      t.direction === "up"
                        ? "text-red-500"
                        : t.direction === "down"
                          ? "text-emerald-500"
                          : "text-slate-400"
                    }`}
                  >
                    {t.direction === "up" && (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    )}
                    {t.direction === "down" && (
                      <ArrowUpRight className="h-3.5 w-3.5 rotate-90" />
                    )}
                    {t.direction === "flat" && (
                      <span className="h-0.5 w-3.5 rounded-full bg-current" />
                    )}
                    {t.direction === "up" && `+${t.delta}`}
                    {t.direction === "down" && `-${t.delta}`}
                    {t.direction === "flat" && "0"}
                  </span>
                );
              })()}
            </div>
            {"showTrend" in stat && stat.showTrend !== undefined ? (
              <>
                <div className="mt-4 flex items-end gap-[3px]">
                  {stat.dataPoints!.map(
                    (m: { unansweredIssuesCount: number }, i: number) => {
                      const isLast = i === stat.dataPoints!.length - 1;
                      const trend = stat.showTrend as number | null;
                      const maxVal = Math.max(
                        ...stat.dataPoints!.map(
                          (p: { unansweredIssuesCount: number }) =>
                            p.unansweredIssuesCount,
                        ),
                        1,
                      );
                      return (
                        <div
                          key={i}
                          className="flex flex-1 flex-col items-center gap-0.5"
                        >
                          <span
                            className={`text-[10px] font-bold tabular-nums ${
                              isLast
                                ? trend !== null && trend > 0
                                  ? "text-red-500"
                                  : trend !== null && trend < 0
                                    ? "text-emerald-500"
                                    : "text-slate-900"
                                : "text-slate-400"
                            }`}
                          >
                            {m.unansweredIssuesCount}
                          </span>
                          <div
                            className={`w-full rounded-[3px] ${
                              isLast
                                ? trend !== null && trend > 0
                                  ? "bg-red-400"
                                  : trend !== null && trend < 0
                                    ? "bg-emerald-400"
                                    : "bg-slate-400"
                                : "bg-slate-200"
                            }`}
                            style={{
                              height: `${Math.max(4, (m.unansweredIssuesCount / maxVal) * 48)}px`,
                            }}
                          />
                          <span className="text-[8px] text-slate-400">
                            {new Date(
                              (
                                stat.dataPoints as Array<{
                                  capturedAt: string;
                                }>
                              )[i]?.capturedAt ?? "",
                            ).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {stat.label}
                </p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {stat.showTrend !== null && (
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                        stat.showTrend > 0
                          ? "text-red-500"
                          : stat.showTrend < 0
                            ? "text-emerald-500"
                            : "text-slate-400"
                      }`}
                    >
                      {stat.showTrend > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : stat.showTrend < 0 ? (
                        <ArrowUpRight className="h-3 w-3 rotate-90" />
                      ) : (
                        <span className="h-0.5 w-3 rounded-full bg-current" />
                      )}
                      {stat.showTrend > 0
                        ? `+${stat.showTrend}`
                        : stat.showTrend}
                      {" over 7 days"}
                    </span>
                  )}
                  {stat.showTrend === null && (
                    <span className="text-[10px] text-slate-400">
                      Insufficient data
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-3xl font-bold tracking-tight tabular-nums text-slate-900">
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {stat.label}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  {stat.description}
                </p>
              </>
            )}
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Last sync: {lastSyncTime}
            </p>
          </div>
        );
      })}
    </div>
  );
}
