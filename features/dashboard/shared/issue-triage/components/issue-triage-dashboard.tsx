"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingIndicator } from "@/components/layout/loading-indicator";
import {
  fetchTriageIssues,
  fetchTriageStats,
  submitTriageAction,
} from "../services/issue-triage-api.service";
import type {
  TriagePrediction,
  TriageStats,
  TriageCorrection,
} from "@/lib/issue-triage/issue-triage.types";

type TabFilter = "all" | "bug" | "feature" | "engineering" | "needs-review";

export function IssueTriageDashboard() {
  const [issues, setIssues] = useState<TriagePrediction[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<TriagePrediction | null>(
    null,
  );
  const [, setStats] = useState<TriageStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadTriagedIssues = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedIssues, fetchedStats] = await Promise.all([
        fetchTriageIssues("all"),
        fetchTriageStats(),
      ]);
      setIssues(fetchedIssues);
      setStats(fetchedStats);
    } catch {
      setError("Failed to load triage data.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [fetchedIssues, fetchedStats] = await Promise.all([
          fetchTriageIssues("all"),
          fetchTriageStats(),
        ]);
        if (!cancelled) {
          setIssues(fetchedIssues);
          setStats(fetchedStats);
        }
      } catch {
        if (!cancelled) setError("Failed to load triage data.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredIssues = issues.filter((issue) => {
    const matchesSearch =
      searchQuery === "" ||
      issue.issueTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `#${issue.issueNumber}`.includes(searchQuery);

    if (!matchesSearch) return false;

    switch (activeTab) {
      case "bug":
        return issue.prediction.labels.some((l) =>
          l.toLowerCase().includes("bug"),
        );
      case "feature":
        return issue.prediction.labels.some(
          (l) =>
            l.toLowerCase().includes("feature") ||
            l.toLowerCase().includes("enhancement"),
        );
      case "engineering":
        return (
          issue.prediction.team === "Engineering" ||
          issue.prediction.team === "CORE" ||
          issue.prediction.team === "Infra"
        );
      case "needs-review":
        return issue.status === "pending";
      default:
        return true;
    }
  });

  const handleReview = async (
    issueNumber: number,
    action: "accept" | "edit" | "reject",
    corrections?: TriageCorrection[],
  ) => {
    const result = await submitTriageAction(issueNumber, action, corrections);
    if (
      result &&
      "labelsApplied" in result &&
      result.labelsApplied &&
      result.labelsApplied.length > 0
    ) {
      const added = result.labelsApplied.join(", ");
      setSuccessMessage(
        `Labels applied to GitHub: [${added}]. "triage needed" label removed.`,
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } else if (action === "reject") {
      setSuccessMessage("Prediction rejected. No changes applied to GitHub.");
      setTimeout(() => setSuccessMessage(null), 3000);
    }
    setIssues((prev) => prev.filter((i) => i.issueNumber !== issueNumber));
    setSelectedIssue(null);
    const fetchedStats = await fetchTriageStats();
    setStats(fetchedStats);
  };

  const tabCounts = {
    all: issues.length,
    bug: issues.filter((i) =>
      i.prediction.labels.some((l) => l.toLowerCase().includes("bug")),
    ).length,
    feature: issues.filter((i) =>
      i.prediction.labels.some(
        (l) =>
          l.toLowerCase().includes("feature") ||
          l.toLowerCase().includes("enhancement"),
      ),
    ).length,
    engineering: issues.filter(
      (i) =>
        i.prediction.team === "Engineering" ||
        i.prediction.team === "CORE" ||
        i.prediction.team === "Infra",
    ).length,
    "needs-review": issues.filter((i) => i.status === "pending").length,
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-gray-50">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b bg-white px-6 py-3">
        <div className="flex items-center gap-1">
          {(
            [
              { key: "all", label: "All" },
              { key: "bug", label: "Bug" },
              { key: "feature", label: "Feature Request" },
              { key: "engineering", label: "Engineering" },
              { key: "needs-review", label: "Needs Review" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs ${
                  activeTab === tab.key ? "text-blue-200" : "text-gray-400"
                }`}
              >
                {tabCounts[tab.key]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search issues..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
            />
          </div>
          <button
            onClick={loadTriagedIssues}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            <svg
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
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
      </div>

      {successMessage && (
        <div className="flex items-center gap-3 border-b bg-emerald-50 px-6 py-3">
          <svg
            className="h-5 w-5 text-emerald-600"
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
          <p className="text-sm font-medium text-emerald-800">
            {successMessage}
          </p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-sm text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel - Issue List */}
        <div className="flex w-[420px] flex-col border-r bg-white">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Unresolved Issues
            </h2>
            <p className="text-xs text-gray-500">
              {filteredIssues.length} issues
            </p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-20">
                <LoadingIndicator />
              </div>
            )}

            {error && !isLoading && (
              <div className="m-4 rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {!isLoading && filteredIssues.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-sm text-gray-500">No issues found</p>
              </div>
            )}

            {filteredIssues.map((issue) => {
              const isSelected =
                selectedIssue?.issueNumber === issue.issueNumber;
              const confidence = issue.prediction.confidenceScore;

              let statusLabel = "Ready";
              let statusColor = "bg-orange-100 text-orange-700";
              if (issue.status === "pending") {
                statusLabel = "Needs Review";
                statusColor = "bg-yellow-100 text-yellow-700";
              } else if (issue.status === "accepted") {
                statusLabel = "Approved";
                statusColor = "bg-green-100 text-green-700";
              } else if (issue.status === "edited") {
                statusLabel = "Edited";
                statusColor = "bg-blue-100 text-blue-700";
              } else if (issue.status === "rejected") {
                statusLabel = "Rejected";
                statusColor = "bg-red-100 text-red-700";
              }

              return (
                <div
                  key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  className={`cursor-pointer border-b px-4 py-3 transition-colors ${
                    isSelected
                      ? "bg-blue-50 border-l-2 border-l-blue-600"
                      : "hover:bg-gray-50 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-900">
                          #{issue.issueNumber}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColor}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-gray-800 line-clamp-2">
                        {issue.issueTitle}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-gray-400">
                        <span>
                          {new Date(issue.createdAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                        <span
                          className={`font-semibold ${
                            confidence >= 90
                              ? "text-green-600"
                              : confidence >= 70
                                ? "text-yellow-600"
                                : "text-red-500"
                          }`}
                        >
                          {confidence}% confidence
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIssue(issue);
                      }}
                      className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel - AI Suggestion */}
        <div className="flex-1 overflow-y-auto">
          {selectedIssue ? (
            <TriageSuggestionPanel
              issue={selectedIssue}
              onReview={handleReview}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-8 w-8 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-lg font-medium text-gray-900">
                  Select an issue to review
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Choose an issue from the left panel to see AI triage
                  suggestions
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Right Panel Component ──────────────────────────────────────────── */

function TriageSuggestionPanel({
  issue,
  onReview,
}: {
  issue: TriagePrediction;
  onReview: (
    issueNumber: number,
    action: "accept" | "edit" | "reject",
    corrections?: TriageCorrection[],
  ) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { prediction: pred } = issue;

  const [editState, setEditState] = useState(() => ({
    labels: [...pred.labels],
    team: pred.team,
    repository: pred.repository,
    cuj: pred.cuj,
    goodFirstIssue: pred.goodFirstIssue,
    priority: pred.priority,
    severity: pred.severity,
    reason: "",
  }));

  // In edit mode, use all labels (so user can modify any). In view mode, show only newLabels
  const displayLabels = isEditing
    ? editState.labels
    : pred.newLabels?.length
      ? pred.newLabels
      : pred.labels;

  const handleAccept = async () => {
    setIsSubmitting(true);
    try {
      await onReview(issue.issueNumber, "accept");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReview(issue.issueNumber, "reject");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async () => {
    const corrections: TriageCorrection[] = [];
    if (JSON.stringify(editState.labels) !== JSON.stringify(pred.labels))
      corrections.push({
        field: "labels",
        predicted: pred.labels,
        corrected: editState.labels,
      });
    if (editState.team !== pred.team)
      corrections.push({
        field: "team",
        predicted: pred.team,
        corrected: editState.team,
      });
    if (editState.repository !== pred.repository)
      corrections.push({
        field: "repository",
        predicted: pred.repository,
        corrected: editState.repository,
      });
    if (editState.cuj !== pred.cuj)
      corrections.push({
        field: "cuj",
        predicted: pred.cuj,
        corrected: editState.cuj,
      });
    if (editState.goodFirstIssue !== pred.goodFirstIssue)
      corrections.push({
        field: "goodFirstIssue",
        predicted: pred.goodFirstIssue,
        corrected: editState.goodFirstIssue,
      });
    if (editState.priority !== pred.priority)
      corrections.push({
        field: "priority",
        predicted: pred.priority,
        corrected: editState.priority,
      });
    if (editState.severity !== pred.severity)
      corrections.push({
        field: "severity",
        predicted: pred.severity,
        corrected: editState.severity,
      });

    if (corrections.length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSubmitting(true);
    try {
      await onReview(issue.issueNumber, "edit", corrections);
      setIsEditing(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLabelToggle = (label: string) => {
    setEditState((prev) => ({
      ...prev,
      labels: prev.labels.includes(label)
        ? prev.labels.filter((l) => l !== label)
        : [...prev.labels, label],
    }));
  };

  const ALL_LABELS = [
    "bug",
    "enhancement",
    "feature",
    "documentation",
    "good first issue",
    "impact-high",
    "impact-medium",
    "impact-low",
    "CI breakage",
    "translation",
    "accessibility",
    "performance",
  ];
  const ALL_TEAMS = [
    "Engineering",
    "Product",
    "Design",
    "Community",
    "Docs",
    "Developer Workflow",
    "LEAP",
    "CORE",
    "Infra",
  ];
  const ALL_REPOS = [
    "oppia/oppia",
    "oppia/oppia-android",
    "oppia/product-operations",
    "oppia/design",
  ];
  const ALL_CUJS = [
    "Learner Experience",
    "Creator Experience",
    "Translation Review",
    "Community Management",
    "Infrastructure",
    "Onboarding",
    "None",
  ];

  return (
    <div className="p-6">
      {/* Issue Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <a
            href={issue.issueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-blue-600 hover:text-blue-800 hover:underline"
          >
            #{issue.issueNumber} — {issue.issueTitle}
          </a>
        </div>
      </div>

      {/* Confidence Score */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold text-white ${
              pred.confidenceScore >= 90
                ? "bg-green-500"
                : pred.confidenceScore >= 70
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
          >
            {pred.confidenceScore}%
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">AI Confidence</p>
            <p className="text-xs text-gray-500">
              {pred.confidenceScore >= 90
                ? "High confidence — prediction is very likely correct"
                : pred.confidenceScore >= 70
                  ? "Moderate confidence — review recommended"
                  : "Low confidence — manual review strongly recommended"}
            </p>
          </div>
        </div>
        {pred.explanation && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              Reasoning
            </p>
            <p className="text-sm text-blue-900">{pred.explanation}</p>
          </div>
        )}
      </div>

      {/* Suggested Labels */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          {isEditing
            ? "All Labels (toggle to add/remove)"
            : "Suggested Labels to Add"}
        </h3>
        {isEditing ? (
          <div className="flex flex-wrap gap-2">
            {ALL_LABELS.map((label) => (
              <button
                key={label}
                onClick={() => handleLabelToggle(label)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors cursor-pointer ${
                  editState.labels.includes(label)
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {displayLabels.length > 0 ? (
              displayLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800"
                >
                  + {label}
                </span>
              ))
            ) : (
              <p className="text-xs text-gray-500">
                No new labels to add — the issue already has all suggested
                labels.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Existing Labels on GitHub */}
      {issue.existingLabels && issue.existingLabels.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Existing Labels on GitHub
          </h3>
          <div className="flex flex-wrap gap-2">
            {issue.existingLabels.map((label) => (
              <span
                key={label}
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                  label === "triage needed"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {label}
                {label === "triage needed" && " (will be removed)"}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggested Metadata */}
      <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Suggested Metadata
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: "Team",
              value: isEditing ? editState.team : pred.team,
              key: "team",
            },
            {
              label: "Repository",
              value: isEditing ? editState.repository : pred.repository,
              key: "repository",
            },
            {
              label: "CUJ",
              value: isEditing ? editState.cuj : pred.cuj,
              key: "cuj",
            },
            {
              label: "Good First Issue",
              value: isEditing ? editState.goodFirstIssue : pred.goodFirstIssue,
              key: "goodFirstIssue",
            },
            {
              label: "Priority",
              value: isEditing ? editState.priority : pred.priority,
              key: "priority",
            },
            {
              label: "Severity",
              value: isEditing ? editState.severity : pred.severity,
              key: "severity",
            },
          ].map((field) => (
            <div key={field.key} className="rounded-lg bg-gray-50 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                {field.label}
              </p>
              {isEditing ? (
                field.key === "goodFirstIssue" ? (
                  <button
                    onClick={() =>
                      setEditState((prev) => ({
                        ...prev,
                        goodFirstIssue: !prev.goodFirstIssue,
                      }))
                    }
                    className={`mt-1 rounded-full px-3 py-0.5 text-xs font-medium cursor-pointer ${
                      editState.goodFirstIssue
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {editState.goodFirstIssue ? "Yes" : "No"}
                  </button>
                ) : field.key === "team" ? (
                  <select
                    value={editState.team}
                    onChange={(e) =>
                      setEditState((prev) => ({
                        ...prev,
                        team: e.target.value,
                      }))
                    }
                    className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs w-full"
                  >
                    {ALL_TEAMS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                ) : field.key === "repository" ? (
                  <select
                    value={editState.repository}
                    onChange={(e) =>
                      setEditState((prev) => ({
                        ...prev,
                        repository: e.target.value,
                      }))
                    }
                    className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs w-full"
                  >
                    {ALL_REPOS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : field.key === "cuj" ? (
                  <select
                    value={editState.cuj}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, cuj: e.target.value }))
                    }
                    className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs w-full"
                  >
                    {ALL_CUJS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                ) : field.key === "priority" ? (
                  <select
                    value={editState.priority}
                    onChange={(e) =>
                      setEditState((prev) => ({
                        ...prev,
                        priority: e.target.value,
                      }))
                    }
                    className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs w-full"
                  >
                    {["critical", "high", "medium", "low"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                ) : field.key === "severity" ? (
                  <select
                    value={editState.severity}
                    onChange={(e) =>
                      setEditState((prev) => ({
                        ...prev,
                        severity: e.target.value,
                      }))
                    }
                    className="mt-1 rounded border border-gray-300 px-2 py-1 text-xs w-full"
                  >
                    {["blocker", "major", "minor", "trivial"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                ) : null
              ) : (
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {typeof field.value === "boolean"
                    ? field.value
                      ? "Yes"
                      : "No"
                    : String(field.value)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Duplicate Detection */}
      {pred.similarIssues.length > 0 && (
        <div className="mb-6 rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">
            Similar Issues Found
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            {pred.similarIssues.length} potentially related issues detected
          </p>
          <div className="space-y-2">
            {pred.similarIssues.map((si) => (
              <a
                key={si.number}
                href={`https://github.com/oppia/oppia/issues/${si.number}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-600">
                    #{si.number}
                  </span>
                  <span className="text-sm text-gray-700 truncate max-w-[300px]">
                    {si.title}
                  </span>
                </div>
                <span className="text-xs font-medium text-gray-500">
                  {Math.round(si.score)}% match
                </span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 mb-6">
        {!isEditing ? (
          <>
            <button
              onClick={handleAccept}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Accept Suggestions
            </button>
            <button
              onClick={() => setIsEditing(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-5 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 cursor-pointer"
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
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              Edit & Review
            </button>
            <button
              onClick={handleReject}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Reject Suggestions
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleEditSubmit}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {/* Corrections */}
      {issue.corrections && issue.corrections.length > 0 && (
        <div className="rounded-xl border bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Corrections Made
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            These corrections are stored to improve future AI predictions
          </p>
          <div className="space-y-2">
            {issue.corrections.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm"
              >
                <span className="text-gray-500 font-medium">{c.field}:</span>
                <span className="text-red-600 line-through">
                  {String(c.predicted)}
                </span>
                <span className="text-gray-400">→</span>
                <span className="text-green-600 font-medium">
                  {String(c.corrected)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
