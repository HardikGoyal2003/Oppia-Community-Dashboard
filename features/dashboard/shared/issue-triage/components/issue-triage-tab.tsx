"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import { TriagePredictionCard } from "./triage-prediction-card";
import {
  fetchTriageIssues,
  fetchTriageStats,
  submitTriageAction,
  fetchUntriagedIssues,
  triggerTriage,
  type UntriagedIssue,
} from "../services/issue-triage-api.service";
import type {
  TriagePrediction,
  TriageStats,
  TriageCorrection,
} from "@/lib/issue-triage/issue-triage.types";

export function IssueTriageTab() {
  const [issues, setIssues] = useState<TriagePrediction[]>([]);
  const [stats, setStats] = useState<TriageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "all" | "untriaged">(
    "pending",
  );

  const [untriagedIssues, setUntriagedIssues] = useState<UntriagedIssue[]>([]);
  const [untriagedMeta, setUntriagedMeta] = useState({
    totalGitHub: 0,
    totalTriaged: 0,
  });
  const [untriagedPage, setUntriagedPage] = useState(1);
  const [triagingIssue, setTriagingIssue] = useState<number | null>(null);
  const [triageError, setTriageError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedIssues, fetchedStats] = await Promise.all([
        fetchTriageIssues(filter === "untriaged" ? "all" : filter),
        fetchTriageStats(),
      ]);
      setIssues(fetchedIssues);
      setStats(fetchedStats);
    } catch {
      setError("Failed to load triage data. Make sure the server is running.");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  const loadUntriaged = useCallback(async (page: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUntriagedIssues(page, 20);
      setUntriagedIssues(data.issues);
      setUntriagedMeta({
        totalGitHub: data.totalGitHub,
        totalTriaged: data.totalTriaged,
      });
    } catch {
      setError("Failed to fetch untriaged issues from GitHub.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (filter === "untriaged") {
        await loadUntriaged(untriagedPage);
      } else {
        await loadData();
      }
    };
    if (!cancelled) run();
    return () => {
      cancelled = true;
    };
  }, [filter, untriagedPage, loadData, loadUntriaged]);

  const handleReview = async (
    issueNumber: number,
    action: "accept" | "edit" | "reject",
    corrections?: TriageCorrection[],
  ) => {
    await submitTriageAction(issueNumber, action, corrections);
    setIssues((prev) => prev.filter((i) => i.issueNumber !== issueNumber));
    const fetchedStats = await fetchTriageStats();
    setStats(fetchedStats);
  };

  const handleTriage = async (issue: UntriagedIssue) => {
    setTriagingIssue(issue.number);
    setTriageError(null);
    try {
      await triggerTriage(
        issue.number,
        issue.title,
        issue.url,
        issue.body,
        issue.labels,
      );
      setUntriagedIssues((prev) =>
        prev.filter((i) => i.number !== issue.number),
      );
    } catch {
      setTriageError(`Failed to triage issue #${issue.number}`);
    } finally {
      setTriagingIssue(null);
    }
  };

  const handleTriageAll = async () => {
    for (const issue of untriagedIssues) {
      if (triagingIssue !== null) continue;
      await handleTriage(issue);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Issue Triage</h1>
        <button
          onClick={
            filter === "untriaged"
              ? () => loadUntriaged(untriagedPage)
              : loadData
          }
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          Refresh
        </button>
      </div>

      {stats && filter !== "untriaged" && (
        <div className="grid grid-cols-5 gap-4">
          {[
            {
              label: "Total Predicted",
              value: stats.totalPredicted,
              color: "bg-gray-500",
            },
            {
              label: "Pending Review",
              value: stats.pending,
              color: "bg-yellow-500",
            },
            { label: "Accepted", value: stats.accepted, color: "bg-green-500" },
            { label: "Edited", value: stats.edited, color: "bg-blue-500" },
            {
              label: "Accuracy",
              value: `${stats.accuracyRate}%`,
              color: "bg-purple-500",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${stat.color}`} />
                <p className="text-xs font-medium text-gray-500">
                  {stat.label}
                </p>
              </div>
              <p className="mt-2 text-2xl font-bold text-gray-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {filter === "untriaged" && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">
              Open Issues on GitHub
            </p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {untriagedMeta.totalGitHub}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Already Triaged</p>
            <p className="mt-2 text-2xl font-bold text-green-600">
              {untriagedMeta.totalTriaged}
            </p>
          </div>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-gray-500">Pending Triage</p>
            <p className="mt-2 text-2xl font-bold text-orange-600">
              {untriagedMeta.totalGitHub - untriagedMeta.totalTriaged}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b pb-3">
        {(["pending", "all", "untriaged"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer ${
              filter === option
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            {option === "pending"
              ? "Pending Review"
              : option === "all"
                ? "All Issues"
                : "Untriaged Issues"}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="py-20">
          <LoadingIndicator />
        </div>
      )}

      {error && !isLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-red-800 font-medium">{error}</p>
          <p className="text-sm text-red-600 mt-1">
            Try running the AI triage backend or check your connection.
          </p>
        </div>
      )}

      {filter === "untriaged" && !isLoading && !error && (
        <div className="space-y-4">
          {untriagedIssues.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {untriagedIssues.length} untriaged issues
              </p>
              <button
                onClick={handleTriageAll}
                disabled={triagingIssue !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 cursor-pointer"
              >
                {triagingIssue !== null ? "Triaging..." : "Triage All"}
              </button>
            </div>
          )}

          {triageError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {triageError}
            </div>
          )}

          {untriagedIssues.length === 0 && !isLoading && (
            <div className="rounded-xl border border-dashed bg-white p-16 text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-gray-900">
                All issues triaged!
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Every open issue on oppia/oppia has been triaged.
              </p>
            </div>
          )}

          {untriagedIssues.map((issue) => (
            <div
              key={issue.number}
              className="rounded-xl border bg-white shadow-sm overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 border-b bg-gray-50 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <a
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    #{issue.number} — {issue.title}
                  </a>
                  <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                    <span>by {issue.author}</span>
                    <span>
                      opened {new Date(issue.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleTriage(issue)}
                  disabled={triagingIssue !== null}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {triagingIssue === issue.number ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Triaging...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Triage
                    </>
                  )}
                </button>
              </div>
              <div className="px-5 py-3">
                {issue.labels.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No labels</p>
                )}
              </div>
            </div>
          ))}

          {untriagedIssues.length > 0 && (
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => setUntriagedPage((p) => Math.max(1, p - 1))}
                disabled={untriagedPage === 1}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page {untriagedPage}
              </span>
              <button
                onClick={() => setUntriagedPage((p) => p + 1)}
                disabled={untriagedIssues.length < 20}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {filter !== "untriaged" &&
        !isLoading &&
        !error &&
        issues.length === 0 && (
          <div className="rounded-xl border border-dashed bg-white p-16 text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900">
              No issues to triage
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {filter === "pending"
                ? "All pending issues have been reviewed. Great work!"
                : "No triage predictions have been created yet."}
            </p>
          </div>
        )}

      {filter !== "untriaged" && !isLoading && !error && issues.length > 0 && (
        <div className="space-y-4">
          {issues.map((issue) => (
            <TriagePredictionCard
              key={issue.id}
              prediction={issue}
              onReview={handleReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}
