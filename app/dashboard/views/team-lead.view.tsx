"use client";

import { useEffect, useState } from "react";
import { IssueCard } from "../components/issue-card";
import { RawIssue } from "@/lib/github/github-fetcher.types";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { useLoading } from "@/components/providers/loader-context";
import { TeamTabs } from "../components/team-tabs";
import { CategorizedProjectIssues, Issue } from "../dashboard.types";
import { getArchivedIssues, unarchiveIssue } from "../../../lib/db/archived-issues.service";
import { useProjectIssuesStore } from "../dashboard.store";
import { categorizeIssues } from "../services/categorize-issues.service";

export default function TeamLeadView() {
  const [responseData, setResponseData] = useState<{ issues: RawIssue[] } | null>(null);
  const [activeTab, setActiveTab] =
    useState<keyof CategorizedProjectIssues>("leap");

  const { isLoading, startLoading, stopLoading } = useLoading();

  const { issues, setIssues } = useProjectIssuesStore();

  const [archivedIssues, setArchivedIssues] = useState<Issue[]>([]);

  const handleClick = async () => {
    startLoading();
    try {
      const archivedIssues =  await getArchivedIssues();
      setArchivedIssues(archivedIssues);
      const res = await fetch("/api/dashboard");
      const data = await res.json();
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
        archivedIssues
      );
      setIssues(categorized);
    })();
  }, [responseData]);

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen
                    px-4 py-18 sm:px-8 md:px-16 lg:px-40">
      <TeamTabs 
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
