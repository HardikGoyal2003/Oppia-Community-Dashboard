"use client";

import { useEffect, useState } from "react";
import { IssueCard } from "./components/issue-card";
import { Issue } from "@/lib/github/types";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { useLoading } from "@/components/providers/loader-context";

interface CategorizedProjectIssues {
  leap: Issue[];
  core: Issue[];
  dev: Issue[];
  others: Issue[];
}

export default function Dashboard() {
  const [responseData, setResponseData] = useState<{ issues: Issue[] } | null>(null);
  const [categorizedProjectIssuesData, setCategorizedProjectIssuesData] =
    useState<CategorizedProjectIssues | null>(null);
  const [activeTab, setActiveTab] =
    useState<keyof CategorizedProjectIssues>("leap");

  const { isLoading, startLoading, stopLoading } = useLoading();

  const tabBaseStyle =
    "border border-t-4 cursor-pointer p-3 sm:p-4 whitespace-nowrap";

  const handleClick = async () => {
    startLoading();
    try {
      const res = await fetch("/api/dashboard");
      const data = await res.json();
      setResponseData(data);
    } finally {
      stopLoading();
    }
  };

  useEffect(() => {
    if (!responseData) return;

    const core: Issue[] = [];
    const leap: Issue[] = [];
    const dev: Issue[] = [];
    const others: Issue[] = [];

    responseData.issues.forEach((issue) => {
      if (issue.linkedProject === "CORE Team (Creators, Operations, Reviewers and Editors)") core.push(issue);
      else if (issue.linkedProject === "LEAP Team (Learners, Educators, Allies, and Parents)") leap.push(issue);
      else if (issue.linkedProject === "Developer Workflow Team") dev.push(issue);
      else others.push(issue);
    });

    setCategorizedProjectIssuesData({ leap, core, dev, others });
  }, [responseData]);

  return (
    <div className="flex flex-col bg-gray-50 min-h-screen
                    px-4 py-18 sm:px-8 md:px-16 lg:px-40">
      {/* Tabs */}
      <div className="flex flex-wrap text-base sm:text-xl translate-y-px">
        {(["leap", "core", "dev", "others"] as const).map((tab) => (
          <div
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`${tabBaseStyle} ${
              activeTab === tab ? "active-tab" : ""
            }`}
          >
            {tab === "leap" && `LEAP Team (${categorizedProjectIssuesData?.leap.length ?? 0})`}
            {tab === "core" && `CORE Team (${categorizedProjectIssuesData?.core.length ?? 0})`}
            {tab === "dev" && `Dev Workflow Team (${categorizedProjectIssuesData?.dev.length ?? 0})`}
            {tab === "others" && `Others (${categorizedProjectIssuesData?.others.length ?? 0})`}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex flex-col gap-4 border py-6 px-2 sm:px-4 bg-white">
        {isLoading && <LoadingIndicator />}

        {!responseData && !isLoading && (
          <button onClick={handleClick} className="border p-2 w-fit">
            Load Issues
          </button>
        )}

        {categorizedProjectIssuesData &&
          categorizedProjectIssuesData[activeTab].map((issue, index) => (
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
