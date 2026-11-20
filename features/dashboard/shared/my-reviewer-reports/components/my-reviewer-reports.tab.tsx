"use client";

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Shield,
} from "lucide-react";
import type { MyReviewerReport } from "@/lib/domain/reviewer-teams.types";
import {
  PendingReviewRows,
  ReviewerStats,
} from "@/features/dashboard/shared/reviewer-reports/reviewer-report-parts";
import { fetchMyReviewerReport } from "../services/my-reviewer-reports-api.service";

/**
 * Displays the review metrics belonging to the signed-in GitHub user.
 *
 * Unlike the admin Reviewer Reports tab, this view is scoped by the session's
 * GitHub login and never exposes other reviewers' data.
 */
export function MyReviewerReportsTab() {
  const [report, setReport] = useState<MyReviewerReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPending, setShowPending] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const loadedReport = await fetchMyReviewerReport();
        if (active) setReport(loadedReport);
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load your reviewer report.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{errorMessage}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <Shield className="mx-auto h-10 w-10 text-slate-300" />
        <h2 className="mt-4 text-lg font-semibold text-slate-700">
          No reviewer report yet
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Reviewer reports appear once your GitHub review activity has been
          synced. If you recently joined a reviewer team, your report will show
          up after the next sync.
        </p>
      </div>
    );
  }

  const { reviewer } = report;
  const pendingBadgeTone =
    reviewer.pendingStaleCount > 0
      ? "bg-red-50 text-red-700"
      : reviewer.pendingReviews > 0
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-500";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            My Reviewer Reports
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Your review activity synced from GitHub.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {new Date(report.lastSyncedAt).toLocaleString("en-IN")}
          </span>
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-600">
            {report.platform}
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center gap-4 px-5 py-5">
          {reviewer.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reviewer.avatarUrl}
              alt={reviewer.username}
              className="h-14 w-14 rounded-full"
            />
          )}
          <div>
            <p className="text-lg font-semibold text-slate-900">
              @{report.username}
            </p>
            <p className="text-sm text-slate-500">
              Reviewer on {report.platform} pull requests
            </p>
          </div>
          <span
            className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${pendingBadgeTone}`}
          >
            {reviewer.pendingReviews} pending
            {reviewer.pendingStaleCount > 0
              ? ` · ${reviewer.pendingStaleCount} stale`
              : ""}
          </span>
        </div>

        {report.teams.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3">
            {report.teams.map((team) => (
              <span
                key={team}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                {team}
              </span>
            ))}
          </div>
        )}

        <ReviewerStats reviewer={reviewer} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setShowPending((previous) => !previous)}
          className="flex w-full items-center gap-2 px-5 py-4 text-left hover:bg-slate-50"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Pending reviews
          </h2>
          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
            {reviewer.assignedPRs.length}
          </span>
          <span className="ml-auto text-slate-400">
            {showPending ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        {showPending &&
          (reviewer.assignedPRs.length > 0 ? (
            <PendingReviewRows prs={reviewer.assignedPRs} />
          ) : (
            <div className="border-t border-slate-100 px-4 py-6 text-center text-sm text-slate-400">
              No PRs assigned.
            </div>
          ))}
      </div>

      <p className="text-xs text-slate-400">
        Metrics are computed from GitHub review activity and synced daily.
      </p>
    </div>
  );
}
