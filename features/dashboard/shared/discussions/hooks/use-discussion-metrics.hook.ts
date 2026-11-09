"use client";

import { useEffect, useState } from "react";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DiscussionMetricPoint } from "@/lib/discussion-metrics/discussion-metrics.service";

type DiscussionMetricsResult = {
  platform: ContributionPlatform;
  metrics: DiscussionMetricPoint[];
  errorMessage: string | null;
};

/**
 * Loads the recent unanswered-discussion history for a platform.
 *
 * @param platform The platform whose metrics should be loaded.
 * @returns The metric points plus loading and error state.
 */
export function useDiscussionMetrics(platform: ContributionPlatform) {
  const [result, setResult] = useState<DiscussionMetricsResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(
          `/api/discussion-metrics?platform=${platform}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          throw new Error("Failed to fetch discussion metrics.");
        }

        const data = (await response.json()) as {
          metrics: DiscussionMetricPoint[];
        };

        if (!cancelled) {
          setResult({ platform, metrics: data.metrics, errorMessage: null });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({
            platform,
            metrics: [],
            errorMessage:
              error instanceof Error
                ? error.message
                : "Failed to fetch discussion metrics.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platform]);

  // Treat a platform change as loading until its own response arrives, without
  // synchronously resetting state inside the effect.
  if (result?.platform === platform) {
    return {
      metrics: result.metrics,
      loading: false,
      errorMessage: result.errorMessage,
    };
  }

  return {
    metrics: [] as DiscussionMetricPoint[],
    loading: true,
    errorMessage: null,
  };
}
