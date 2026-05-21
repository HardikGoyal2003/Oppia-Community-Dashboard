"use client";

import { LayoutDashboard } from "lucide-react";

export function EmptyFallback() {
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
