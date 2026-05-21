"use client";

import { useEffect, useState } from "react";
import {
  Area,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
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
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type TeamLead = {
  role: "TEAM_LEAD" | "LEAD_TRAINEE";
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
    capturedAt: string;
    dateKey: string;
    unansweredIssuesCount: number;
  }>;
  nextSteps: Array<{
    message: string;
    priority: "high" | "medium";
    reason: string;
  }>;
  platform: "WEB" | "ANDROID";
  teamName: string;
};

type TeamLeadOverviewResponse = {
  report: TeamReport;
};

type ChartTooltipPayloadItem = {
  color?: string;
  name?: string;
  payload?: {
    capturedAt?: string;
  };
  value?: number | string | null;
};

const GFI_DOMAIN_COLORS = {
  backend: "#2563eb",
  frontend: "#14b8a6",
  fullstack: "#f59e0b",
  uncategorized: "#94a3b8",
} as const;

const STAT_CARD_STYLES = [
  {
    accent: "from-blue-600 to-blue-400",
    bg: "bg-blue-50",
    icon: "text-blue-600",
    gradient: "from-blue-50/50",
  },
  {
    accent: "from-emerald-500 to-emerald-400",
    bg: "bg-emerald-50",
    icon: "text-emerald-600",
    gradient: "from-emerald-50/50",
  },
  {
    accent: "from-violet-500 to-violet-400",
    bg: "bg-violet-50",
    icon: "text-violet-600",
    gradient: "from-violet-50/50",
  },
  {
    accent: "from-amber-500 to-amber-400",
    bg: "bg-amber-50",
    icon: "text-amber-600",
    gradient: "from-amber-50/50",
  },
];

const CHART_GRADIENT_ID = "unanswered-issues-gradient";

function formatChartTickLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    hour: "2-digit",
    hour12: true,
    minute: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function formatChartTooltipLabel(capturedAtIso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(capturedAtIso));
}

function getCurrentUnansweredIssuesCount(report: TeamReport): number {
  return report.metrics.at(-1)?.unansweredIssuesCount ?? 0;
}

function getStatusSummary(report: TeamReport): {
  badgeClassName: string;
  description: string;
  label: string;
} {
  const currentUnansweredIssues = getCurrentUnansweredIssuesCount(report);
  const highPriorityStepCount = report.nextSteps.filter(
    (step) => step.priority === "high",
  ).length;

  if (highPriorityStepCount > 0 || currentUnansweredIssues >= 12) {
    return {
      badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
      description:
        "Your backlog or staffing needs attention before it starts slowing down contributor support.",
      label: "Needs attention",
    };
  }

  if (currentUnansweredIssues >= 6 || report.nextSteps.length > 0) {
    return {
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-800",
      description:
        "Your team is stable, with a few follow-ups worth scheduling soon.",
      label: "Stable",
    };
  }

  return {
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-800",
    description:
      "Backlog, coverage, and staffing look healthy with no immediate action flagged.",
    label: "Healthy",
  };
}

function getTotalGfiCount(counts: TeamReport["gfiCounts"]): number {
  return (
    counts.backend + counts.frontend + counts.fullstack + counts.uncategorized
  );
}

function getTeamLeadActionMessage(message: string): string {
  if (message.startsWith("Ask leads to add ")) {
    return message.replace(/^Ask leads to add /, "Add ");
  }

  if (
    message ===
    "Ask leads about the team\u2019s issue response performance because unanswered issues are consistently growing."
  ) {
    return "Review your team\u2019s issue response performance because unanswered issues are consistently growing.";
  }

  if (
    message ===
    "Ask leads to categorize uncategorized good first issues into frontend, backend, or fullstack."
  ) {
    return "Categorize uncategorized good first issues into frontend, backend, or fullstack.";
  }

  if (message === "It is better to onboard one trainee lead in this team.") {
    return "Onboard one trainee lead in your team.";
  }

  if (message.startsWith("Onboard ")) {
    return message.replace(/in this team\.$/, "in your team.");
  }

  return message;
}

function getStatusVariant(label: string): {
  dot: string;
  ring: string;
} {
  if (label === "Needs attention") {
    return { dot: "bg-amber-500", ring: "ring-amber-200" };
  }
  if (label === "Stable") {
    return { dot: "bg-sky-500", ring: "ring-sky-200" };
  }
  return { dot: "bg-emerald-500", ring: "ring-emerald-200" };
}

function AndroidTeamGfiSummary({
  counts,
}: {
  counts: TeamReport["gfiCounts"];
}) {
  const total = getTotalGfiCount(counts);
  const progress = Math.min((total / 15) * 100, 100);
  const statusLabel =
    total >= 15
      ? "Healthy pipeline"
      : total >= 8
        ? "Needs growth"
        : "Low stock";

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(148,163,184,0.14),_transparent_40%),linear-gradient(135deg,_#ffffff_0%,_#f8fafc_55%,_#f1f5f9_100%)] px-5 py-5">
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-slate-200/50 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 left-6 h-20 w-20 rounded-full bg-sky-100/50 blur-2xl" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Android GFI Pool
          </p>
          <p className="mt-3 text-4xl font-semibold leading-none text-slate-950">
            {total}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Open starter issues available for Android contributors.
          </p>
        </div>

        <span className="rounded-full border border-white/80 bg-white/75 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm backdrop-blur">
          {statusLabel}
        </span>
      </div>

      <div className="relative mt-5 rounded-xl border border-white/70 bg-white/80 p-4 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Coverage Progress
          </p>
          <p className="text-sm font-medium text-slate-700">
            {progress.toFixed(0)}%
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,_#334155_0%,_#0f172a_100%)] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Targeting a steady pool of 15+ open good first issues keeps Android
          onboarding simple and visible.
        </p>
      </div>
    </div>
  );
}

function TeamLeadGfiDonutSection({
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

function TeamOverviewChartTooltip({
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

function TeamOverviewUnansweredIssuesChart({
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
