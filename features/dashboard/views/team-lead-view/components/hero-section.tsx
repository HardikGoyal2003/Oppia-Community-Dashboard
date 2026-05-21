"use client";

import { LayoutDashboard } from "lucide-react";
import { formatDisplayValue } from "@/lib/utils/display.utils";
import type { StatusSummary, StatusVariant } from "../overview.types";

export function HeroSection({
  teamName,
  platform,
  status,
  variant,
  lastUpdated,
}: {
  teamName: string;
  platform: string;
  status: StatusSummary;
  variant: StatusVariant;
  lastUpdated: string | Date;
}) {
  return (
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
              {teamName.replace(/^\[(Web|Android)\]\s*/i, "")}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                {formatDisplayValue(platform)}
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
              Last daily sync: {new Date(lastUpdated).toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-slate-600">
          {status.description}
        </p>
      </div>
    </section>
  );
}
