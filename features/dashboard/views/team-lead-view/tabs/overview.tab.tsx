"use client";

import { useEffect, useState } from "react";
import {
  ChartPie,
  Sparkles,
  TrendingUp,
  Users,
  ListChecks,
} from "lucide-react";
import type { TeamReport, TeamLeadOverviewResponse } from "../overview.types";
import {
  getCurrentUnansweredIssuesCount,
  getStatusSummary,
  getStatusVariant,
  getTotalGfiCount,
} from "../overview.utils";
import { AndroidTeamGfiSummary } from "../components/android-team-gfi-summary";
import { TeamLeadGfiDonutSection } from "../components/team-lead-gfi-donut-section";
import { TeamOverviewUnansweredIssuesChart } from "../components/team-overview-unanswered-issues-chart";
import { OverviewSkeleton } from "../components/overview-skeleton";
import { ErrorFallback } from "../components/error-fallback";
import { EmptyFallback } from "../components/empty-fallback";
import { HeroSection } from "../components/hero-section";
import { StatCards } from "../components/stat-cards";
import { NextActions } from "../components/next-actions";
import { LeadCoverage } from "../components/lead-coverage";

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
      <HeroSection
        teamName={report.teamName}
        platform={report.platform}
        status={status}
        variant={variant}
        lastUpdated={report.lastUpdated}
      />

      <StatCards statCards={statCards} lastSyncTime={lastSyncTime} />

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <NextActions
          nextSteps={report.nextSteps}
          unresolvedActionCount={unresolvedActionCount}
        />
        <LeadCoverage leads={report.leads} />
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
