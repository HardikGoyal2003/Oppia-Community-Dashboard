"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { IssueCard } from "./issues/components/issue-card";
import { RawIssue } from "@/lib/github/github.types";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { useLoading } from "@/components/providers/loader-context";
import { TeamTabs } from "./team-tabs";
import { CategorizedProjectIssues, Issue } from "../dashboard.types";
import { getArchivedIssues } from "../../../db/archived-issues.db";
import { useProjectIssuesStore } from "./issues/store/project-issues.store";
import { categorizeIssues } from "./issues/services/categorize-issues.service";

export default function UnansweredIssuesTab() {
  const [responseData, setResponseData] = useState<{ issues: RawIssue[] } | null>(null);
  const [activeTab, setActiveTab] =
    useState<keyof CategorizedProjectIssues>("team1");

  const { isLoading, startLoading, stopLoading } = useLoading();

  const { issues, setIssues } = useProjectIssuesStore();

  const [archivedIssues, setArchivedIssues] = useState<Issue[]>([]);

  const { data: session } = useSession();
  const platform = session?.user.platform;

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
    startLoading();
    try {
      const issuesResponse = await fetch("/api/github/issues", {
        cache: "no-store",
      });

      if (!issuesResponse.ok) {
        throw new Error("Failed to fetch GitHub issues.");
      }

      const issuesData = (await issuesResponse.json()) as {
        issues: RawIssue[];
      };

      const [archivedIssues, data] = await Promise.all([
        getArchivedIssues(platform),
        Promise.resolve(issuesData),
      ]) 
      setArchivedIssues(archivedIssues);
      setResponseData(data);
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    if (!responseData) return;

    (async () => {
      const categorized = await categorizeIssues(
        responseData.issues,
        archivedIssues,
        platform
      );
      setIssues(categorized);
    })();
  }, [responseData, archivedIssues, platform, setIssues]);

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen
                    px-4 py-18 sm:px-8 md:px-16 lg:px-40">
      <TeamTabs 
      platform={platform}
      categorizedProjectIssuesData = {issues}
      activeTab={activeTab}
      setActiveTab={setActiveTab}/>

      {/* Content */}
      <div className="flex flex-col gap-4 border py-6 px-2 sm:px-4 bg-white">
        {isLoading && <LoadingIndicator />}

        {!responseData && !isLoading && (
          <button onClick={handleClick} className="border p-2 w-fit">
            Load Issues
          </button>
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
                Big thanks for staying responsive and keeping your team&apos;s issue flow healthy.
                Your consistency is helping keep the Oppia community active, supported, and moving forward.
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
    </div>
  );
}
