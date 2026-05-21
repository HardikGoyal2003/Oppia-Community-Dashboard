"use client";

import type { TeamReport } from "../overview.types";
import { getTotalGfiCount } from "../overview.utils";

export function AndroidTeamGfiSummary({
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
