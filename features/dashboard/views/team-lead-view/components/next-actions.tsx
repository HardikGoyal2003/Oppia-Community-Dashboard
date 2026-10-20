"use client";

import { useEffect, useRef } from "react";
import {
  Check,
  CheckCircle2,
  ListChecks,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type {
  ActionItem,
  ActionItemReviewStatus,
} from "@/features/dashboard/shared/action-items/action-items.types";
import { isStaleActionItem } from "@/features/dashboard/shared/action-items/action-items.utils";
import { getTeamLeadActionMessage } from "../overview.utils";

type NextActionsProps = {
  items: ActionItem[];
  loading: boolean;
  error: string | null;
  actionError: string | null;
  busyItemId: string | null;
  highlightedId: string | null;
  onReview: (item: ActionItem, status: ActionItemReviewStatus) => void;
  onRetry: () => void;
};

function ActionButton({
  children,
  disabled,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
  tone?: "neutral" | "primary" | "danger-ghost";
}) {
  const toneClasses =
    tone === "primary"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100"
      : tone === "danger-ghost"
        ? "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses}`}
    >
      {children}
    </button>
  );
}

export function NextActions({
  items,
  loading,
  error,
  actionError,
  busyItemId,
  highlightedId,
  onReview,
  onRetry,
}: NextActionsProps) {
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightedId) {
      return;
    }

    const element = itemRefs.current[highlightedId];
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightedId, items.length]);

  const unresolvedActionCount = items.length;
  const isBusy = busyItemId !== null;

  return (
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
          {!loading && !error && unresolvedActionCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-800 px-2 text-[11px] font-semibold text-white">
              {unresolvedActionCount}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              <p className="text-sm text-slate-500">
                Loading your action items…
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3.5">
              <p className="text-sm text-red-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-800">
                No immediate action flagged for this team.
              </p>
            </div>
          ) : (
            items.map((item, index) => {
              const isStale = isStaleActionItem(item);
              const isAcknowledged = item.status === "ACKNOWLEDGED";
              const isHighlighted = highlightedId === item.id;

              return (
                <div
                  key={item.id}
                  ref={(element) => {
                    itemRefs.current[item.id] = element;
                  }}
                  className={`relative rounded-xl border px-4 py-3.5 transition-colors ${
                    isHighlighted
                      ? "border-blue-300 bg-blue-50/40 ring-2 ring-blue-400"
                      : item.priority === "high"
                        ? "border-red-100 bg-white hover:border-red-200"
                        : "border-amber-100 bg-white hover:border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    <div className="relative flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          item.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {index + 1}
                      </div>
                      {index < items.length - 1 && (
                        <div className="mt-1 h-full w-px bg-slate-200" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {getTeamLeadActionMessage(item.message)}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                            item.priority === "high"
                              ? "bg-red-100 text-red-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-slate-500">
                        {item.reason}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isAcknowledged && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700">
                            Acknowledged
                          </span>
                        )}
                        {isStale && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-700">
                            No longer detected
                          </span>
                        )}
                        {item.escalationLevel > 0 && (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-700">
                            Reminder #{item.escalationLevel}
                            {item.lastEscalatedAt
                              ? ` · ${new Date(
                                  item.lastEscalatedAt,
                                ).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}`
                              : ""}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          Detected since{" "}
                          {new Date(item.detectedAt).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {item.status === "OPEN" && (
                          <ActionButton
                            disabled={isBusy}
                            onClick={() => onReview(item, "ACKNOWLEDGED")}
                          >
                            {busyItemId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                            Acknowledge
                          </ActionButton>
                        )}
                        <ActionButton
                          tone="primary"
                          disabled={isBusy}
                          onClick={() => onReview(item, "RESOLVED")}
                        >
                          <Check className="h-3 w-3" />
                          Resolve
                        </ActionButton>
                        <ActionButton
                          tone="danger-ghost"
                          disabled={isBusy}
                          onClick={() => onReview(item, "DISMISSED")}
                        >
                          <X className="h-3 w-3" />
                          Dismiss
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {actionError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-700">
              {actionError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
