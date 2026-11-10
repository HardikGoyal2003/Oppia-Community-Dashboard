"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  BarChart3,
  CalendarDays,
  PieChart,
  ScatterChart as ScatterIcon,
} from "lucide-react";
import type {
  ReviewerApprovalShare,
  ReviewerMonthlyUniquePoint,
  ReviewerPrSizePoint,
  ReviewerTeamsAnalytics,
  ReviewerWeeklyPoint,
} from "@/lib/domain/reviewer-teams.types";

type WeeklyTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ReviewerWeeklyPoint }>;
};

type MonthlyTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ReviewerMonthlyUniquePoint }>;
};

type ScatterTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ReviewerPrSizePoint }>;
};

const TOP_APPROVER_COUNT = 5;

/**
 * Formats an ISO date key as a short `12 Nov` label.
 *
 * @param isoDate The ISO date key to format.
 * @returns The short label.
 */
function formatWeekLabel(isoDate: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(isoDate));
}

/**
 * Formats a `YYYY-MM` key as a short `Nov 25` label.
 *
 * @param month The month key to format.
 * @returns The short label.
 */
function formatMonthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function ChartCard({
  title,
  description,
  icon,
  children,
  footer,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
      {footer}
    </section>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 text-center text-xs text-slate-400">
      {message}
    </div>
  );
}

function WeeklyTooltip({ active, payload }: WeeklyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">
        Week of {formatWeekLabel(point.weekStart)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">{point.reviews}</span>{" "}
        review{point.reviews === 1 ? "" : "s"} submitted
      </p>
    </div>
  );
}

function MonthlyTooltip({ active, payload }: MonthlyTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">
        {formatMonthLabel(point.month)}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        <span className="font-semibold text-slate-900">
          {point.uniqueReviewers}
        </span>{" "}
        unique reviewer{point.uniqueReviewers === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function ScatterTooltip({ active, payload }: ScatterTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-slate-900">
        PR #{point.prNumber}
      </p>
      <p className="mt-1 text-xs text-slate-600">
        {point.additions} lines added · {point.reviewTimeHours.toFixed(1)}h to
        first review
      </p>
    </div>
  );
}

function TopApproversCard({
  approvers,
  totalApprovals,
}: {
  approvers: ReviewerApprovalShare[];
  totalApprovals: number;
}) {
  const top = approvers.slice(0, TOP_APPROVER_COUNT);
  const topApprovals = top.reduce((sum, entry) => sum + entry.approvals, 0);
  const topSharePct =
    totalApprovals > 0 ? (topApprovals / totalApprovals) * 100 : 0;

  return (
    <ChartCard
      title="Top approver concentration"
      description={`Share of approvals handled by the top ${TOP_APPROVER_COUNT} reviewers.`}
      icon={<PieChart className="h-4 w-4" />}
      footer={
        totalApprovals > 0 ? (
          <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
            Top {TOP_APPROVER_COUNT} reviewers account for{" "}
            <strong className="font-semibold text-slate-800">
              {topSharePct.toFixed(1)}%
            </strong>{" "}
            of {totalApprovals} total approvals.
          </p>
        ) : null
      }
    >
      {top.length === 0 ? (
        <EmptyChart message="No approvals recorded yet." />
      ) : (
        <div className="space-y-3">
          {top.map((entry) => (
            <div key={entry.username}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate font-medium text-slate-700">
                  @{entry.username}
                </span>
                <span className="ml-2 shrink-0 text-slate-500">
                  {entry.approvals} · {entry.sharePct.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${Math.min(100, (entry.sharePct / Math.max(top[0]?.sharePct ?? 1, 1)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

/**
 * Renders org-wide reviewer analytics: weekly review velocity, monthly unique
 * reviewers, top-approver concentration, and a PR-size vs review-time scatter.
 *
 * @param analytics The analytics block returned by `/api/reviewer-teams`.
 * @returns The analytics section.
 */
export function ReviewerAnalyticsSection({
  analytics,
}: {
  analytics: ReviewerTeamsAnalytics;
}) {
  const weeklyData = analytics.weeklyReviews.map((point) => ({
    ...point,
    weekLabel: formatWeekLabel(point.weekStart),
  }));

  const monthlyData = analytics.monthlyUniqueReviewers.map((point) => ({
    ...point,
    monthLabel: formatMonthLabel(point.month),
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard
        title="Reviews submitted per week"
        description="A review is any submitted review (comment, request changes, or approval) — not only approvals."
        icon={<BarChart3 className="h-4 w-4" />}
      >
        {weeklyData.length === 0 ? (
          <EmptyChart message="No weekly review activity yet." />
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={weeklyData}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip
                  content={<WeeklyTooltip />}
                  cursor={{ fill: "#f1f5f9" }}
                />
                <Bar
                  dataKey="reviews"
                  name="Reviews"
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <ChartCard
        title="Unique reviewers per month"
        description="Team members who submitted at least one review in the month. Should trend upward."
        icon={<CalendarDays className="h-4 w-4" />}
      >
        {monthlyData.length === 0 ? (
          <EmptyChart message="No monthly reviewer activity yet." />
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthlyData}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid
                  stroke="#e2e8f0"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="monthLabel"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <Tooltip content={<MonthlyTooltip />} />
                <Line
                  type="monotone"
                  dataKey="uniqueReviewers"
                  name="Unique reviewers"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "#059669" }}
                  activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <TopApproversCard
        approvers={analytics.topApprovers}
        totalApprovals={analytics.totalApprovals}
      />

      <ChartCard
        title="PR size vs review time"
        description="Lines added (ignoring deletions) against hours from assignment to first review."
        icon={<ScatterIcon className="h-4 w-4" />}
        footer={
          analytics.prSizeScatter.length > 0 ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              Data only — no size limit is enforced yet.
            </p>
          ) : null
        }
      >
        {analytics.prSizeScatter.length === 0 ? (
          <EmptyChart message="No PR size data yet. PR details sync with review cycles." />
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                data={analytics.prSizeScatter}
                margin={{ top: 8, right: 8, bottom: 4, left: -16 }}
              >
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  dataKey="additions"
                  name="Lines added"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="reviewTimeHours"
                  name="Review time (h)"
                  tick={{ fill: "#94a3b8", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={36}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  content={<ScatterTooltip />}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter dataKey="reviewTimeHours" name="PRs">
                  {analytics.prSizeScatter.map((point) => (
                    <Cell
                      key={point.prNumber}
                      fill={point.additions > 300 ? "#f59e0b" : "#2563eb"}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
