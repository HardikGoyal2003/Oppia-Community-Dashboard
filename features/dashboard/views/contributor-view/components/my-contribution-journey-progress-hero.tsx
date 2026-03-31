"use client";

import { Flag } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/classnames.utils";

type PhaseCheckpoint = {
  id: string;
  leftPercentage: number;
  status: "complete" | "in_progress" | "recommended_left";
  title: string;
};

export default function MyContributionJourneyProgressHero({
  activePhaseTitle,
  completedCount,
  completedRequiredCount,
  phaseCheckpoints,
  phaseCount,
  progressPercentage,
  requiredChecklistItemCount,
  totalChecklistItemCount,
}: {
  activePhaseTitle: string;
  completedCount: number;
  completedRequiredCount: number;
  phaseCheckpoints: PhaseCheckpoint[];
  phaseCount: number;
  progressPercentage: number;
  requiredChecklistItemCount: number;
  totalChecklistItemCount: number;
}) {
  return (
    <div className="grid gap-4">
      <div className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_58%,#0f766e_100%)] px-6 py-6 text-white shadow-[0_28px_65px_-40px_rgba(15,23,42,0.75)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-100/90">
              Active Phase
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">
                {activePhaseTitle}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-200">
                {phaseCount} phases are currently mapped out in your journey.
                Start here, then move phase by phase as you build momentum.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-200">
              Progress
            </p>
            <p className="mt-1 text-3xl font-semibold">{progressPercentage}%</p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-200">
            <span>
              {completedRequiredCount}/{requiredChecklistItemCount} required
              items completed
            </span>
            <span>Keep going</span>
          </div>
          <div className="relative pt-5">
            <div className="h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 via-cyan-300 to-emerald-300 transition-all"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            {phaseCheckpoints.map((checkpoint) => (
              <Tooltip key={checkpoint.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="absolute top-0 -translate-x-1/2"
                    style={{ left: `${checkpoint.leftPercentage}%` }}
                  >
                    <Flag
                      className={cn(
                        "h-4 w-4",
                        checkpoint.status === "complete"
                          ? "text-emerald-300"
                          : checkpoint.status === "recommended_left"
                            ? "text-red-400"
                            : "text-white/80",
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  <p className="font-medium">{checkpoint.title}</p>
                  {checkpoint.status === "recommended_left" && (
                    <p>Medium tasks are strongly advised to complete.</p>
                  )}
                  {checkpoint.status === "complete" && (
                    <p>All high and medium tasks in this phase are done.</p>
                  )}
                  {checkpoint.status === "in_progress" && (
                    <p>Required tasks in this phase are still pending.</p>
                  )}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
          <p className="text-xs text-slate-300">
            Overall checklist completion: {completedCount}/
            {totalChecklistItemCount}
          </p>
        </div>
      </div>
    </div>
  );
}
