"use client";

import { ListChecks, Sparkles } from "lucide-react";
import type { TeamReport } from "../overview.types";
import { getTeamLeadActionMessage } from "../overview.utils";

export function NextActions({
  nextSteps,
  unresolvedActionCount,
}: {
  nextSteps: TeamReport["nextSteps"];
  unresolvedActionCount: number;
}) {
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
          {unresolvedActionCount > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-800 px-2 text-[11px] font-semibold text-white">
              {unresolvedActionCount}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-5">
        <div className="space-y-3">
          {nextSteps.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-800">
                No immediate action flagged for this team.
              </p>
            </div>
          ) : (
            nextSteps.map((step, index) => (
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
                    {index < nextSteps.length - 1 && (
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
  );
}
