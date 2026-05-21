"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  ChartPie,
  LayoutDashboard,
  ListChecks,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { getRoleDisplayLabel } from "@/lib/auth/role-display";
import { formatDisplayValue } from "@/lib/utils/display.utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamReport, TeamLeadOverviewResponse } from "../overview.types";
import {
  STAT_CARD_STYLES,
  getCurrentUnansweredIssuesCount,
  getStatusSummary,
  getStatusVariant,
  getTeamLeadActionMessage,
  getTotalGfiCount,
} from "../overview.utils";
import { AndroidTeamGfiSummary } from "../components/android-team-gfi-summary";
import { TeamLeadGfiDonutSection } from "../components/team-lead-gfi-donut-section";
import { TeamOverviewUnansweredIssuesChart } from "../components/team-overview-unanswered-issues-chart";

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-white via-slate-50/80 to-blue-50/30 p-8">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-9 w-72" />
              <Skeleton className="h-4 w-48" />
            </div>
            <Skeleton className="h-7 w-28 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-4 w-full max-w-xl" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <Skeleton className="h-9 w-9 rounded-lg" />
            <Skeleton className="mt-4 h-9 w-20" />
            <Skeleton className="mt-2 h-3 w-24" />
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Skeleton className="h-5 w-28" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-6 h-52 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorFallback({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
        <div className="flex items-center gap-4 bg-gradient-to-r from-red-50 to-red-50/50 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-red-900">
              Failed to load team overview
            </h2>
            <p className="mt-0.5 text-sm text-red-600">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyFallback() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 shadow-sm">
        <LayoutDashboard className="mb-4 h-10 w-10 text-slate-300" />
        <h3 className="text-base font-semibold text-slate-700">
          No team overview found
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Team report data is not available yet.
        </p>
      </div>
    </div>
  );
}

export default function TeamLeadOverviewTab() {
  const [report, setReport] = useState<TeamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/team-reports/my-team", {
          cache: "no-store",
        });

        if (!response.ok) {
          const errorPayload = (await response.json()) as {
            error?: string;
          };
          throw new Error(
            errorPayload.error ?? "Failed to load team overview.",
          );
        }

        const data = (await response.json()) as TeamLeadOverviewResponse;
        setReport(data.report);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load team overview.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadReport();
  }, []);

  if (loading) {
    return <OverviewSkeleton />;
  }

  if (errorMessage) {
    return <ErrorFallback message={errorMessage} />;
  }

  if (!report) {
    return <EmptyFallback />;
  }

  const currentUnansweredIssues = getCurrentUnansweredIssuesCount(report);
  const totalGfis = getTotalGfiCount(report.gfiCounts);
  const unresolvedActionCount = report.nextSteps.length;
  const status = getStatusSummary(report);
  const variant = getStatusVariant(status.label);

  const lastSyncTime = new Date(report.lastUpdated).toLocaleString("en-IN");

  const performanceMetrics = report.metrics.slice(-7);
  const performanceTrend =
    performanceMetrics.length >= 2
      ? performanceMetrics.at(-1)!.unansweredIssuesCount -
        performanceMetrics.at(0)!.unansweredIssuesCount
      : null;

  const statCards = [
    {
      icon: Sparkles,
      label: "Open GFIs",
      value: totalGfis,
      description: "Starter-issue pool from the latest daily sync.",
      trend: null,
    },
    {
      icon: TrendingUp,
      label: "7-Day Performance",
      value: performanceMetrics.length,
      showTrend: performanceTrend,
      dataPoints: performanceMetrics,
      metricCount: report.metrics.length,
      trend: null,
    },
    {
      icon: Users,
      label: "Leads",
      value: report.leads.length,
      description: "Team leads and lead trainees currently assigned.",
      trend: null,
    },
    {
      icon: ListChecks,
      label: "Action Items",
      value: unresolvedActionCount,
      description:
        "Priority follow-ups based on backlog, GFI coverage, and staffing.",
      trend: null,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-40 w-40 rounded-full bg-violet-400/8 blur-3xl" />

        <div className="relative bg-gradient-to-br from-white via-slate-50/80 to-blue-50/30 px-8 py-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                  <LayoutDashboard className="h-4.5 w-4.5 text-white" />
                </div>
                <h1 className="text-lg font-semibold text-slate-900">
                  Team Overview
                </h1>
              </div>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
                {report.teamName.replace(/^\[(Web|Android)\]\s*/i, "")}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {formatDisplayValue(report.platform)}
                </span>
                {" team"}
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm ${status.badgeClassName}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${variant.dot} ring-2 ${variant.ring}`}
                />
                {status.label}
              </span>
              <span className="text-xs text-slate-400">
                Last daily sync:{" "}
                {new Date(report.lastUpdated).toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-600">
            {status.description}
          </p>
        </div>
      </section>

      {/* Stat Cards */}
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
                    {stat.dataPoints.map(
                      (m: { unansweredIssuesCount: number }, i: number) => {
                        const isLast = i === stat.dataPoints.length - 1;
                        const trend = stat.showTrend as number | null;
                        const maxVal = Math.max(
                          ...stat.dataPoints.map(
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

      {/* Middle Section: Next Actions + Lead Coverage */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        {/* Next Actions Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <ListChecks className="h-4 w-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Your Next Actions
                </h2>
              </div>
              {unresolvedActionCount > 0 && (
                <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-800 px-2 text-[11px] font-semibold text-white">
                  {unresolvedActionCount}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-3">
              {report.nextSteps.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                    <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-emerald-800">
                    No immediate action flagged for this team.
                  </p>
                </div>
              ) : (
                report.nextSteps.map((step, index) => (
                  <div
                    key={step.message}
                    className={`relative rounded-xl border px-4 py-3.5 transition-colors ${
                      step.priority === "high"
                        ? "border-red-100 bg-white hover:border-red-200"
                        : "border-amber-100 bg-white hover:border-amber-200"
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            step.priority === "high"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {index + 1}
                        </div>
                        {index < report.nextSteps.length - 1 && (
                          <div className="mt-1 h-full w-px bg-slate-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-slate-900">
                            {getTeamLeadActionMessage(step.message)}
                          </p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              step.priority === "high"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {step.priority}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {step.reason}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Lead Coverage Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <Users className="h-4 w-4 text-slate-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Team Leads
                </h2>
              </div>
              <span className="text-xs font-medium text-slate-500">
                {report.leads.length}{" "}
                {report.leads.length === 1 ? "lead" : "leads"}
              </span>
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="space-y-2.5">
              {report.leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8">
                  <Users className="mb-2 h-6 w-6 text-slate-300" />
                  <p className="text-sm text-slate-500">
                    No leads synced for this team yet.
                  </p>
                </div>
              ) : (
                report.leads.map((lead) => {
                  const initial = lead.username
                    ? lead.username.charAt(0).toUpperCase()
                    : "?";
                  return (
                    <div
                      key={lead.uid}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-slate-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-white shadow-sm">
                          {initial}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            @{lead.username}
                          </p>
                          <p className="text-xs text-slate-500">Lead</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                        {getRoleDisplayLabel(lead.role)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        {/* GFI Breakdown Card */}
        <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <ChartPie className="h-4 w-4 shrink-0 text-slate-600" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">
                  GFI Breakdown
                </h2>
              </div>
              <span className="shrink-0 text-xs font-medium text-slate-500">
                {totalGfis} total
              </span>
            </div>
          </div>
          <div className="px-5 py-5">
            {report.platform === "ANDROID" ? (
              <AndroidTeamGfiSummary counts={report.gfiCounts} />
            ) : (
              <div className="overflow-hidden rounded-xl bg-gradient-to-br from-slate-50/80 via-white to-slate-50/40 p-4 sm:p-6">
                <TeamLeadGfiDonutSection counts={report.gfiCounts} />
              </div>
            )}
          </div>
        </div>

        {/* Unanswered Issues Over Time Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-white to-slate-50/80 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                  <TrendingUp className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Unanswered Issues Over Time
                  </h2>
                  <p className="text-xs text-slate-500">
                    Track how your team&apos;s backlog is moving.
                  </p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {currentUnansweredIssues}
              </span>
            </div>
          </div>
          <div className="px-6 py-5">
            <TeamOverviewUnansweredIssuesChart metrics={report.metrics} />
          </div>
        </div>
      </div>
    </div>
  );
}
