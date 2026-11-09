"use client";

import { useEffect, useState } from "react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getRoleDisplayLabel } from "@/lib/auth/role-display";
import { formatDisplayValue } from "@/lib/utils/display.utils";
import { TeamGfiSummary } from "@/features/dashboard/shared/gfi/team-gfi-summary";
import { PlatformUnansweredIssuesChart } from "@/features/dashboard/shared/team-reports/components/platform-unanswered-issues-chart";
import { useActionItems } from "@/features/dashboard/shared/action-items/hooks/use-action-items.hook";
import { getActiveActionItemsForTeam } from "@/features/dashboard/shared/action-items/action-items.utils";
import type { ActionItem } from "@/features/dashboard/shared/action-items/action-items.types";

type TeamLead = {
  role: "TEAM_LEAD" | "LEAD_TRAINEE";
  uid: string;
  username: string;
};

type TeamReport = {
  id: string;
  gfiCount: number;
  lastUpdated: string | Date;
  leads: TeamLead[];
  metrics: Array<{
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
    maxWaitingDays: number;
  }>;
  nextSteps: Array<{
    ruleKey: string;
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

function getReportTeamLabel(teamName: string): string {
  return teamName
    .replace(/^\[(web|android)\]\s*/i, "")
    .replace(/\s+team\b.*$/i, "")
    .trim();
}

function TeamActionItemsPanel({
  report,
  items,
  loading,
  error,
}: {
  report: TeamReport;
  items: ActionItem[];
  loading: boolean;
  error: string | null;
}) {
  const teamItems = getActiveActionItemsForTeam(items, report.id);

  const derivedFallback =
    report.nextSteps.length === 0 ? (
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
            <p className="text-sm font-medium text-slate-800">{step.message}</p>
            <p className="text-xs leading-5 text-slate-500">{step.reason}</p>
          </div>
        </div>
      ))
    );

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Action Items</h3>
        {!loading && !error && teamItems.length > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-800 px-1.5 text-[10px] font-semibold text-white">
            {teamItems.length}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white px-3 py-3 text-sm text-slate-500">
            Loading tracked action items…
          </p>
        ) : error ? (
          derivedFallback
        ) : teamItems.length === 0 ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            No immediate action flagged for this team.
          </p>
        ) : (
          teamItems.map((item, index) => (
            <div
              key={item.id}
              className={`flex gap-3 rounded-xl px-3 py-3 ${
                item.priority === "high"
                  ? "border border-red-300 bg-white"
                  : "border border-amber-200 bg-white"
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  item.priority === "high"
                    ? "bg-red-200 text-red-900"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-slate-800">
                    {item.message}
                  </p>
                  {item.notificationCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                      Nudges sent: {item.notificationCount}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-5 text-slate-500">
                  {item.reason}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TeamReportsTab() {
  const [reports, setReports] = useState<TeamReport[]>([]);
  const [platform, setPlatform] = useState<ContributionPlatform>("WEB");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    items: actionItems,
    loading: actionItemsLoading,
    errorMessage: actionItemsError,
  } = useActionItems();

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
                  GFI Count
                </h3>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <TeamGfiSummary
                    gfiCount={report.gfiCount}
                    platform={report.platform}
                  />
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

                <TeamActionItemsPanel
                  report={report}
                  items={actionItems}
                  loading={actionItemsLoading}
                  error={actionItemsError}
                />
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
