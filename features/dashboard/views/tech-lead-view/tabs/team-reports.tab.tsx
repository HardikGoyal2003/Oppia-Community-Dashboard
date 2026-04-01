"use client";

import { useEffect, useState } from "react";
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
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { formatDisplayValue } from "@/lib/utils/display.utils";

type TeamLead = {
  uid: string;
  username: string;
};

type TeamReport = {
  id: string;
  gfiCounts: {
    backend: number;
    frontend: number;
    fullstack: number;
    uncategorized: number;
  };
  lastUpdated: string | Date;
  leads: TeamLead[];
  metrics: Array<{
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: string[];
  platform: "WEB" | "ANDROID";
  teamName: string;
};

type TeamReportsResponse = {
  generatedAt: string;
  reports: TeamReport[];
};

const TEAM_CHART_COLORS = [
  "#0f172a",
  "#2563eb",
  "#0891b2",
  "#dc2626",
  "#16a34a",
  "#7c3aed",
];

function getPlatformChartSeries(reports: TeamReport[]): Array<{
  color: string;
  points: Array<{ dateKey: string; unansweredIssuesCount: number }>;
  teamId: string;
  teamName: string;
}> {
  const allDateKeys = Array.from(
    new Set(
      reports.flatMap((report) =>
        report.metrics.map((metric) => metric.dateKey),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return reports.map((report, index) => {
    const metricMap = new Map(
      report.metrics.map((metric) => [
        metric.dateKey,
        metric.unansweredIssuesCount,
      ]),
    );

    return {
      color: TEAM_CHART_COLORS[index % TEAM_CHART_COLORS.length],
      points: allDateKeys.map((dateKey) => ({
        dateKey,
        unansweredIssuesCount: metricMap.get(dateKey) ?? 0,
      })),
      teamId: report.id,
      teamName: report.teamName,
    };
  });
}

function getPlatformChartData(
  reports: TeamReport[],
): Array<Record<string, number | string>> {
  const allDateKeys = Array.from(
    new Set(
      reports.flatMap((report) =>
        report.metrics.map((metric) => metric.dateKey),
      ),
    ),
  ).sort((left, right) => left.localeCompare(right));

  return allDateKeys.map((dateKey) => {
    const row: Record<string, number | string> = { dateKey };

    for (const report of reports) {
      const metric = report.metrics.find((item) => item.dateKey === dateKey);
      row[report.id] = metric?.unansweredIssuesCount ?? 0;
    }

    return row;
  });
}

function PlatformUnansweredIssuesChart({ reports }: { reports: TeamReport[] }) {
  const series = getPlatformChartSeries(reports);
  const chartData = getPlatformChartData(reports);

  if (reports.length === 0) {
    return null;
  }

  if (chartData.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unanswered Issues vs Date-Time
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Compare unanswered issue counts across all{" "}
              {formatDisplayValue(reports[0].platform)} teams.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-500">
            No daily team metrics captured yet for this platform.
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
            Unanswered Issues vs Date-Time
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Compare unanswered issue counts across all{" "}
            {formatDisplayValue(reports[0].platform)} teams.
          </p>
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
                dataKey="dateKey"
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
              <Tooltip
                contentStyle={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  backgroundColor: "#ffffff",
                }}
              />
              <Legend />
              {series.map((item) => (
                <Line
                  key={item.teamId}
                  type="monotone"
                  dataKey={item.teamId}
                  name={item.teamName}
                  stroke={item.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function GfiCountPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export function TeamReportsTab() {
  const [reports, setReports] = useState<TeamReport[]>([]);
  const [platform, setPlatform] = useState<ContributionPlatform>("WEB");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      <div className="grid gap-6 xl:grid-cols-2">
        {filteredReports.map((report) => (
          <section
            key={report.id}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {report.platform}
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">
                  {report.teamName}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Last metadata sync:{" "}
                  {new Date(report.lastUpdated).toLocaleString("en-IN")}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Leads
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {report.leads.length}
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">
                GFI Domain Coverage
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <GfiCountPill
                  label="Frontend"
                  value={report.gfiCounts.frontend}
                />
                <GfiCountPill
                  label="Backend"
                  value={report.gfiCounts.backend}
                />
                <GfiCountPill
                  label="Fullstack"
                  value={report.gfiCounts.fullstack}
                />
                <GfiCountPill
                  label="Uncategorized"
                  value={report.gfiCounts.uncategorized}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Leads</h3>
                <div className="mt-3 space-y-2">
                  {report.leads.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-300 px-3 py-3 text-sm text-slate-500">
                      No leads synced for this team yet.
                    </p>
                  ) : (
                    report.leads.map((lead) => (
                      <div
                        key={lead.uid}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800"
                      >
                        @{lead.username}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Next Steps
                </h3>
                <div className="mt-3 space-y-2">
                  {report.nextSteps.length === 0 ? (
                    <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
                      No immediate action flagged for this team.
                    </p>
                  ) : (
                    report.nextSteps.map((step) => (
                      <div
                        key={step}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900"
                      >
                        {step}
                      </div>
                    ))
                  )}
                </div>
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
