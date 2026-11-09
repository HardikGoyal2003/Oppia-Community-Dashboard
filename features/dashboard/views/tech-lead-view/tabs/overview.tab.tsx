"use client";

import { Sparkles } from "lucide-react";
import { DiscussionsComparisonCard } from "@/features/dashboard/shared/discussions/components/discussions-comparison-card";
import { InfoCallout } from "@/features/dashboard/shared/overview/components/info-callout";

export function AdminOverviewTab() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-2 text-sm text-slate-600">
          A high-level view of community health across the organization —
          discussion responsiveness, unanswered issue trends, and more.
        </p>
      </div>

      <DiscussionsComparisonCard
        title="Unanswered Discussions Over Time"
        description="Daily unanswered discussion trends for oppia/oppia (web) and oppia/oppia-android (android)."
      />

      <InfoCallout
        icon={Sparkles}
        tone="accent"
        title="More exciting things are coming"
        description="We're building new ways to help maintainers support the community. Stay tuned!"
      />
    </div>
  );
}
