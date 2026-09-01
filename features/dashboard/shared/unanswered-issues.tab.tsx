"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { IssueCard } from "./issues/components/issue-card";
import { GitHubIssue } from "@/lib/github/github.types";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { useLoading } from "@/components/providers/loader-context";
import { TeamTabs } from "./team-tabs";
import type { Issue } from "@/lib/domain/issues.types";
import { CategorizedProjectIssues } from "../dashboard.types";
import { useProjectIssuesStore } from "./issues/store/project-issues.store";
import { categorizeIssues } from "./issues/services/categorize-issues.service";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import { getArchivedIssuesForPlatform } from "./issues/services/archived-issues-api.service";
import {
  getCachedData,
  setCachedData,
  computeTtlFromLastUpdated,
} from "@/lib/utils/local-storage-cache";
import { getErrorCodeMeta } from "@/lib/errors/error-codes";
import { ErrorCard } from "@/components/error/error-card";

type CachedOrgMeta = {
  orgMembers: string[];
  collaborators: { login: string; permission: string }[];
  lastUpdated: string;
};

const ORG_META_CACHE_KEY_PREFIX = "oppia_org_meta";
const GITHUB_API_UNAVAILABLE_META = getErrorCodeMeta("GITHUB_API_UNAVAILABLE");

export default function UnansweredIssuesTab() {
  const [responseData, setResponseData] = useState<{
    issues: GitHubIssue[];
  } | null>(null);
  const [activeTab, setActiveTab] =
    useState<keyof CategorizedProjectIssues>("team1");
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showGitHubError, setShowGitHubError] = useState(false);

  const { isLoading, startLoading, stopLoading } = useLoading();

  const { issues, setIssues } = useProjectIssuesStore();

  const [archivedIssues, setArchivedIssues] = useState<Issue[]>([]);

  const { data: session } = useSession();
  const platform = session?.user?.platform;
  const hasPlatform = platform !== null && platform !== undefined;

  const teamLabelMap: Record<string, string> =
    platform === "ANDROID"
      ? {
          team1: "CLAM Team",
          team2: "Dev Workflow & Infrastructure Team",
          team3: "",
          others: "",
        }
      : {
          team1: "LEAP Team",
          team2: "CORE Team",
          team3: "Dev Workflow Team",
          others: "",
        };

  const handleClick = async () => {
    if (!hasPlatform) return;

    startLoading();
    setFetchError(null);
    setShowGitHubError(false);
    try {
      const cacheKey = `${ORG_META_CACHE_KEY_PREFIX}_${platform}`;
      const cachedOrgMeta = getCachedData<CachedOrgMeta>(cacheKey);

      const issuesResponse = await fetch("/api/github/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgMeta: cachedOrgMeta ?? null }),
      });

      if (!issuesResponse.ok) {
        if (issuesResponse.status === 502) {
          setShowGitHubError(true);
          return;
        }

        throw new Error("Failed to fetch GitHub issues.");
      }

      const issuesData = (await issuesResponse.json()) as {
        issues: GitHubIssue[];
        orgMeta: CachedOrgMeta | null;
      };

      if (issuesData.orgMeta) {
        const ttl = computeTtlFromLastUpdated(issuesData.orgMeta.lastUpdated);
        if (ttl > 0) {
          setCachedData(cacheKey, issuesData.orgMeta, ttl);
        }
      }

      const archivedIssues = await getArchivedIssuesForPlatform(platform);
      setArchivedIssues(archivedIssues);
      setResponseData(issuesData);
    } catch (error) {
      setFetchError(
        error instanceof Error
          ? error.message
          : "Failed to fetch GitHub issues.",
      );
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    if (!responseData || !hasPlatform) return;

    (async () => {
      const categorized = await categorizeIssues(
        responseData.issues,
        archivedIssues,
        platform,
      );
      setIssues(categorized);
    })();
  }, [responseData, archivedIssues, hasPlatform, platform, setIssues]);

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
          {hasPlatform && (
            <TeamTabs
              platform={platform as ContributionPlatform}
              categorizedProjectIssuesData={issues}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            />
          )}

          {/* Content */}
          <div className="flex flex-col gap-4 border py-6 px-2 sm:px-4 bg-white">
            {isLoading && <LoadingIndicator />}

            {!responseData && !isLoading && (
              <button onClick={handleClick} className="border p-2 w-fit">
                Load Issues
              </button>
            )}

            {fetchError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {fetchError}
              </div>
            )}

            {!hasPlatform && (
              <div className="border p-4 text-sm text-slate-600">
                Select a contribution platform to load issues.
              </div>
            )}

            {issues &&
              responseData &&
              activeTab !== "archive" &&
              issues[activeTab].length === 0 && (
                <div className="py-20 text-center">
                  <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-slate-100 px-4 py-1 text-sm font-medium text-slate-700">
                    <span>🎉</span>
                    <span>All issues cleared</span>
                  </div>

                  <p className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
                    Great job, {teamLabelMap[activeTab] || "team"} leads! 🙌
                  </p>

                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                    Big thanks for staying responsive and keeping your
                    team&apos;s issue flow healthy. Your consistency is helping
                    keep the Oppia community active, supported, and moving
                    forward.
                  </p>
                </div>
              )}

            {issues &&
              issues[activeTab].map((issue, index) => (
                <IssueCard
                  key={issue.issueNumber}
                  issue={issue}
                  serialNumber={index + 1}
                />
              ))}
          </div>
        </>
      )}
    </div>
  );
}
