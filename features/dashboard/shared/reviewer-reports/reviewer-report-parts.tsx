"use client";

import { useState } from "react";
import { Clock, ExternalLink } from "lucide-react";
import type {
  PendingReview,
  ReviewerTeamMember,
} from "@/lib/domain/reviewer-teams.types";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const PENDING_STALE_CUTOFF_HOURS = 48;

/**
 * Formats the time a PR has been waiting for a review.
 *
 * @param iso The assignment timestamp.
 * @param nowMs The current timestamp in ms.
 * @returns A compact elapsed-time label.
 */
export function waitingSince(iso: string, nowMs: number): string {
  const hours = (nowMs - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return `${days}d ${remaining}h`;
}

/**
 * Formats an average duration in hours.
 *
 * @param hours The average duration, or null when unavailable.
 * @returns A human-readable duration label.
 */
export function formatHours(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining === 0 ? `${days}d` : `${days}d ${remaining}h`;
}

/**
 * Renders a labelled reviewer metric with an explanatory tooltip.
 */
export function Stat({
  label,
  value,
  tooltip,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tooltip: string;
  tone?: "default" | "warning" | "danger";
}) {
  const valueClass =
    tone === "danger"
      ? "text-red-600"
      : tone === "warning"
        ? "text-amber-600"
        : "text-slate-800";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="cursor-help text-center">
          <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
          <p className="text-[11px] leading-tight text-slate-500">{label}</p>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Renders the standard reviewer statistic grids.
 */
export function ReviewerStats({ reviewer }: { reviewer: ReviewerTeamMember }) {
  return (
    <>
      <div className="grid grid-cols-3 gap-x-2 gap-y-3 border-t border-slate-100 px-3 py-3">
        <Stat
          label="Reviews"
          value={reviewer.completedReviewSubmissions}
          tooltip="Every review submission (comment, request changes, or approval). One PR can receive multiple reviews, so this is not the same as PRs reviewed."
        />
        <Stat
          label="PRs reviewed"
          value={reviewer.reviewedPrCount}
          tooltip="Distinct PRs this reviewer submitted at least one review on."
        />
        <Stat
          label="Pending"
          value={reviewer.pendingReviews}
          tone={reviewer.pendingStaleCount > 0 ? "warning" : "default"}
          tooltip="Open PRs currently assigned for review and not yet reviewed or unassigned."
        />
        <Stat
          label="First review"
          value={formatHours(reviewer.avgReviewTimeHours)}
          tooltip="Average time from initial assignment to the reviewer's first review submission."
        />
        <Stat
          label="To approval"
          value={formatHours(reviewer.avgTimeToApprovalHours)}
          tooltip="Average time from initial assignment to the reviewer's first approval."
        />
        <Stat
          label="Reviews/week"
          value={
            reviewer.avgReviewsPerWeek !== null
              ? Math.round(reviewer.avgReviewsPerWeek)
              : "—"
          }
          tooltip="Average review submissions per active week. A review is any submitted review, not only an approval. Rounded to a whole number."
        />
      </div>

      <div className="grid grid-cols-3 gap-x-2 gap-y-3 border-t border-slate-100 bg-slate-50/60 px-3 py-3">
        <Stat
          label="Rounds"
          value={
            reviewer.avgReviewRoundsBeforeApproval !== null
              ? Math.round(reviewer.avgReviewRoundsBeforeApproval)
              : "—"
          }
          tooltip="Average number of review submissions before the first approval, across PRs that were eventually approved. Rounded to a whole number."
        />
        <Stat
          label="Comments"
          value={
            reviewer.avgCommentsPerReview !== null
              ? Math.round(reviewer.avgCommentsPerReview)
              : "—"
          }
          tooltip="Average non-empty review bodies plus inline code comments per completed review cycle. Rounded to a whole number."
        />
        <Stat
          label="Approved / Authored"
          value={
            reviewer.approvalToAuthoredRatio !== null
              ? `${reviewer.approvalToAuthoredRatio.toFixed(2)}×`
              : "—"
          }
          tooltip={`Approvals given: ${reviewer.approvedPrCount} PRs. PRs authored: ${reviewer.authoredPrCount}. A large gap between team members may indicate uneven review load.`}
        />
      </div>
    </>
  );
}

/**
 * Renders the pending PR list for a reviewer.
 *
 * @param prs The reviewer's open assignments.
 * @param compact Whether to use the denser styling used in expanded team cards.
 */
export function PendingReviewRows({
  prs,
  compact = false,
}: {
  prs: PendingReview[];
  compact?: boolean;
}) {
  const [nowMs] = useState(() => Date.now());

  return (
    <div
      className={
        compact
          ? "border-t border-slate-100 bg-white"
          : "divide-y divide-slate-100 border-t border-slate-100 bg-slate-50"
      }
    >
      {prs.map((pr) => {
        const waitHours =
          (nowMs - new Date(pr.assignedAt).getTime()) / 3_600_000;
        const isStale = waitHours >= PENDING_STALE_CUTOFF_HOURS;

        return (
          <div
            key={pr.prNumber}
            className={
              compact
                ? "flex items-center gap-2 px-4 py-2 pl-8"
                : "flex items-center gap-2 px-4 py-2.5"
            }
          >
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              className={
                compact
                  ? "flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                  : "flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              }
            >
              #{pr.prNumber}
              <ExternalLink
                className={
                  compact ? "h-2.5 w-2.5 shrink-0" : "h-3 w-3 shrink-0"
                }
              />
            </a>
            <span
              className={
                compact
                  ? "min-w-0 flex-1 truncate text-[11px] text-slate-600"
                  : "min-w-0 flex-1 truncate text-xs text-slate-600"
              }
            >
              {pr.title}
            </span>
            <span
              className={
                compact
                  ? `flex shrink-0 items-center gap-0.5 text-[10px] ${
                      isStale ? "font-medium text-red-600" : "text-slate-400"
                    }`
                  : `flex shrink-0 items-center gap-1 text-xs ${
                      isStale ? "font-medium text-red-600" : "text-slate-400"
                    }`
              }
            >
              <Clock className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
              {waitingSince(pr.assignedAt, nowMs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
