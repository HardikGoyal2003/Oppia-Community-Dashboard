"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DiscussionCard } from "./discussions/components/discussion-card";
import { DiscussionsOverTimeChart } from "./discussions/components/discussions-over-time-chart";
import { DiscussionTabs } from "./discussions/components/discussion-tabs";
import { EmptyState } from "./empty-state";
import { GitHubDiscussion } from "@/lib/github/github.types";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { useLoading } from "@/components/providers/loader-context";
import type { Discussion } from "@/lib/domain/discussions.types";
import { CategorizedProjectDiscussions } from "../dashboard.types";
import { useProjectDiscussionsStore } from "./discussions/store/project-discussions.store";
import { categorizeDiscussions } from "./discussions/services/categorize-discussions.service";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getArchivedDiscussionsForPlatform } from "./discussions/services/archived-discussions-api.service";
import type { DiscussionMetricPoint } from "@/lib/discussion-metrics/discussion-metrics.service";
import { getErrorCodeMeta } from "@/lib/errors/error-codes";
import { ErrorCard } from "@/components/error/error-card";
import { formatDisplayValue } from "@/lib/utils/display.utils";
import {
  computeTtlFromLastUpdated,
  getCachedData,
  setCachedData,
} from "@/lib/utils/local-storage-cache";
import { MonitorSmartphone } from "lucide-react";
import { cn } from "@/lib/utils/classnames.utils";

type CachedOrgMeta = {
  orgMembers: string[];
  collaborators: { login: string; permission: string }[];
  lastUpdated: string;
};

const ORG_META_CACHE_KEY_PREFIX = "oppia_org_meta";
const GITHUB_API_UNAVAILABLE_META = getErrorCodeMeta("GITHUB_API_UNAVAILABLE");
const PLATFORM_OPTIONS: ContributionPlatform[] = ["WEB", "ANDROID"];
const PLATFORM_REPO_LABEL: Record<ContributionPlatform, string> = {
  WEB: "oppia/oppia",
  ANDROID: "oppia/oppia-android",
};

export default function UnansweredDiscussionsTab() {
  const [responseData, setResponseData] = useState<{
    discussions: GitHubDiscussion[];
  } | null>(null);
  const [activeTab, setActiveTab] =
    useState<keyof CategorizedProjectDiscussions>("active");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showGitHubError, setShowGitHubError] = useState(false);

  const { isLoading, startLoading, stopLoading } = useLoading();

  const { discussions, setDiscussions } = useProjectDiscussionsStore();

  const [archivedDiscussions, setArchivedDiscussions] = useState<Discussion[]>(
    [],
  );

  const [discussionMetrics, setDiscussionMetrics] = useState<
    DiscussionMetricPoint[]
  >([]);

  const { data: session } = useSession();
  const sessionPlatform = session?.user?.platform ?? null;
  const role = session?.user?.role;
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";

  const [selectedPlatform, setSelectedPlatform] =
    useState<ContributionPlatform | null>(null);

  const platform = isAdmin
    ? (selectedPlatform ?? sessionPlatform)
    : sessionPlatform;
  const hasPlatform = platform !== null && platform !== undefined;

  const handleClick = async () => {
    if (!hasPlatform) return;

    startLoading();
    setFetchError(null);
    setShowGitHubError(false);
    try {
      const cacheKey = `${ORG_META_CACHE_KEY_PREFIX}_${platform}`;
      const cachedOrgMeta = getCachedData<CachedOrgMeta>(cacheKey);

      const discussionsResponse = await fetch("/api/github/discussions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgMeta: cachedOrgMeta ?? null,
          platform,
        }),
      });

      if (!discussionsResponse.ok) {
        if (discussionsResponse.status === 502) {
          setShowGitHubError(true);
          return;
        }

        throw new Error("Failed to fetch GitHub discussions.");
      }

      const discussionsData = (await discussionsResponse.json()) as {
        discussions: GitHubDiscussion[];
        orgMeta: CachedOrgMeta | null;
      };

      if (discussionsData.orgMeta) {
        const ttl = computeTtlFromLastUpdated(
          discussionsData.orgMeta.lastUpdated,
        );
        if (ttl > 0) {
          setCachedData(cacheKey, discussionsData.orgMeta, ttl);
        }
      }

      const archivedDiscussions =
        await getArchivedDiscussionsForPlatform(platform);
      setArchivedDiscussions(archivedDiscussions);
      setResponseData(discussionsData);
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Failed to fetch GitHub discussions.",
      );
    } finally {
      stopLoading();
    }
  };

  const handlePlatformChange = (nextPlatform: ContributionPlatform) => {
    if (nextPlatform === platform) return;

    setSelectedPlatform(nextPlatform);
    setActiveTab("active");
    setResponseData(null);
    setArchivedDiscussions([]);
    setDiscussionMetrics([]);
    setFetchError(null);
    setShowGitHubError(false);
    setDiscussions({
      active: [],
      archive: [],
    });
  };

  useEffect(() => {
    if (!responseData || !hasPlatform || !platform) return;

    (async () => {
      try {
        const categorized = await categorizeDiscussions(
          responseData.discussions,
          archivedDiscussions,
          platform,
        );
        setDiscussions(categorized);
      } catch (error) {
        setFetchError(
          error instanceof Error
            ? error.message
            : "Failed to categorize discussions.",
        );
      }
    })();
  }, [
    responseData,
    archivedDiscussions,
    hasPlatform,
    platform,
    setDiscussions,
  ]);

  useEffect(() => {
    if (!hasPlatform || !platform) {
      return;
    }

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
          setDiscussionMetrics(data.metrics);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setDiscussionMetrics([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPlatform, platform]);

  return (
    <div
      className="flex flex-col bg-gray-50 min-h-screen
                    px-4 py-18 sm:px-8 md:px-16 lg:px-40"
    >
      {showGitHubError ? (
        <div className="flex flex-1 items-center justify-center py-8">
          <ErrorCard meta={GITHUB_API_UNAVAILABLE_META} />
        </div>
      ) : (
        <>
          {isAdmin && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <MonitorSmartphone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Contribution platform
                  </p>
                  <p className="text-xs text-slate-500">
                    {platform
                      ? `Viewing unanswered discussions from ${PLATFORM_REPO_LABEL[platform]}.`
                      : "Choose a platform to view unanswered discussions."}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
                {PLATFORM_OPTIONS.map((option) => {
                  const isActive = platform === option;

                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => handlePlatformChange(option)}
                      className={cn(
                        "rounded-lg px-4 py-1.5 text-sm font-medium transition-all",
                        isActive
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-500 hover:text-slate-800",
                      )}
                    >
                      {formatDisplayValue(option)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasPlatform && (
            <div className="mb-5">
              <DiscussionsOverTimeChart
                metrics={discussionMetrics}
                platformLabel={
                  platform ? PLATFORM_REPO_LABEL[platform] : "this platform"
                }
              />
            </div>
          )}

          {hasPlatform && (
            <DiscussionTabs
              categorizedProjectDiscussionsData={discussions}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}

          {/* Content */}
          <div className="flex flex-col gap-4 border py-6 px-2 sm:px-4 bg-white">
            {isLoading && <LoadingIndicator />}

            {!responseData && !isLoading && (
              <button onClick={handleClick} className="border p-2 w-fit">
                Load Discussions
              </button>
            )}

            {fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fetchError}
              </div>
            )}

            {!hasPlatform && (
              <div className="border p-4 text-sm text-slate-600">
                Select a contribution platform to load discussions.
              </div>
            )}

            {discussions &&
              responseData &&
              activeTab === "active" &&
              discussions.active.length === 0 && (
                <EmptyState
                  icon="🎉"
                  badge="All discussions cleared"
                  title="Great job, team! 🙌"
                  description="Big thanks for staying responsive and keeping the Oppia community's discussions active, supported, and moving forward."
                />
              )}

            {discussions &&
              responseData &&
              activeTab === "archive" &&
              discussions.archive.length === 0 && (
                <EmptyState
                  icon="🗂️"
                  badge="No archived discussions"
                  title="Nothing here yet"
                  description="Discussions you mark as done or archive will show up here, so you can revisit handled conversations later."
                />
              )}

            {discussions &&
              discussions[activeTab].map((discussion, index) => (
                <DiscussionCard
                  key={discussion.discussionNumber}
                  discussion={discussion}
                  serialNumber={index + 1}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
