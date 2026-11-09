"use client";

import { HeartHandshake, Sparkles } from "lucide-react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { DiscussionsTrendCard } from "@/features/dashboard/shared/discussions/components/discussions-trend-card";
import { InfoCallout } from "@/features/dashboard/shared/overview/components/info-callout";

export function TeamMemberOverviewTab({
  platform,
}: {
  platform: ContributionPlatform;
}) {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Overview</h1>
        <p className="mt-2 text-sm text-slate-600">
          Keep an eye on unanswered discussions for your platform and help keep
          the community moving.
        </p>
      </div>

      <DiscussionsTrendCard
        platform={platform}
        title="Unanswered Discussions Over Time"
        description="Daily unanswered discussion trends for your platform."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <InfoCallout
          icon={HeartHandshake}
          title="More than code"
          description="Open source now isn't just about writing code anymore — it's about growing the community and helping the community in managing."
        />
        <InfoCallout
          icon={Sparkles}
          tone="accent"
          title="More exciting things are coming"
          description="Stay tuned for new features and tools built for the community."
        />
      </div>
    </div>
  );
}
