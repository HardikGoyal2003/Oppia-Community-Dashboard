"use client";

import { cn } from "@/lib/utils/classnames.utils";
import { useDiscussionMetrics } from "../hooks/use-discussion-metrics.hook";
import { DiscussionsComparisonChart } from "./discussions-comparison-chart";

/**
 * Self-loading card that compares the web and android discussion trends.
 */
export function DiscussionsComparisonCard({
  title,
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const web = useDiscussionMetrics("WEB");
  const android = useDiscussionMetrics("ANDROID");

  const loading = web.loading || android.loading;
  const errorMessage = web.errorMessage ?? android.errorMessage;
  const resolvedTitle = title ?? "Unanswered Discussions Over Time";

  if (loading) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
          className,
        )}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {resolvedTitle}
        </h2>
        <div className="mt-5 flex h-72 animate-pulse flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12">
          <div className="h-8 w-8 rounded-full bg-slate-200" />
          <div className="mt-4 h-3 w-48 rounded bg-slate-200" />
        </div>
      </section>
    );
  }

  if (errorMessage) {
    return (
      <section
        className={cn(
          "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
          className,
        )}
      >
        <h2 className="text-lg font-semibold text-slate-900">
          {resolvedTitle}
        </h2>
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      </section>
    );
  }

  return (
    <DiscussionsComparisonChart
      series={[
        { platform: "WEB", metrics: web.metrics },
        { platform: "ANDROID", metrics: android.metrics },
      ]}
      title={resolvedTitle}
      description={description}
      className={className}
    />
  );
}
