"use client";

import { useState } from "react";
import type { TriagePrediction } from "@/lib/issue-triage/issue-triage.types";
import { TriageEditDialog } from "./triage-edit-dialog";

interface TriagePredictionCardProps {
  prediction: TriagePrediction;
  onReview: (
    issueNumber: number,
    action: "accept" | "edit" | "reject",
    corrections?: {
      field: string;
      predicted: string | string[] | boolean;
      corrected: string | string[] | boolean;
    }[],
  ) => Promise<void>;
}

export function TriagePredictionCard({
  prediction,
  onReview,
}: TriagePredictionCardProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { prediction: pred } = prediction;

  const handleAction = async (action: "accept" | "edit" | "reject") => {
    if (action === "edit") {
      setIsEditing(true);
      return;
    }

    setIsReviewing(true);
    setError(null);
    try {
      await onReview(prediction.issueNumber, action);
    } catch {
      setError("Failed to submit review. Please try again.");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleEditSubmit = async (
    corrections: {
      field: string;
      predicted: string | string[] | boolean;
      corrected: string | string[] | boolean;
    }[],
  ) => {
    setIsReviewing(true);
    setError(null);
    try {
      await onReview(prediction.issueNumber, "edit", corrections);
      setIsEditing(false);
    } catch {
      setError("Failed to submit edit. Please try again.");
    } finally {
      setIsReviewing(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
    accepted: "bg-green-100 text-green-800 border-green-300",
    edited: "bg-blue-100 text-blue-800 border-blue-300",
    rejected: "bg-red-100 text-red-800 border-red-300",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pending Review",
    accepted: "Accepted",
    edited: "Edited",
    rejected: "Rejected",
  };

  return (
    <>
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b bg-gray-50 px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <a
                href={prediction.issueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate"
              >
                #{prediction.issueNumber} — {prediction.issueTitle}
              </a>
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  statusColors[prediction.status]
                }`}
              >
                {statusLabels[prediction.status]}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-500">
              Confidence
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                pred.confidenceScore >= 90
                  ? "bg-green-100 text-green-800"
                  : pred.confidenceScore >= 70
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {pred.confidenceScore}%
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            {pred.labels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
              >
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <span className="text-gray-500">Team:</span>{" "}
              <span className="font-medium">{pred.team}</span>
            </div>
            <div>
              <span className="text-gray-500">Repository:</span>{" "}
              <span className="font-medium">{pred.repository}</span>
            </div>
            <div>
              <span className="text-gray-500">CUJ:</span>{" "}
              <span className="font-medium">{pred.cuj}</span>
            </div>
            <div>
              <span className="text-gray-500">Good First Issue:</span>{" "}
              <span className="font-medium">
                {pred.goodFirstIssue ? "Yes" : "No"}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Priority:</span>{" "}
              <span className="font-medium">{pred.priority}</span>
            </div>
            <div>
              <span className="text-gray-500">Severity:</span>{" "}
              <span className="font-medium">{pred.severity}</span>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
            <p className="text-xs font-semibold text-blue-700 mb-1">
              AI Reasoning
            </p>
            <p className="text-sm text-blue-900">{pred.explanation}</p>
          </div>

          {pred.similarIssues.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-1.5">
                Similar Issues
              </p>
              <div className="flex flex-wrap gap-2">
                {pred.similarIssues.map((si) => (
                  <span
                    key={si.number}
                    className="inline-flex items-center gap-1 rounded-md bg-gray-50 border px-2 py-1 text-xs text-gray-600"
                  >
                    <span className="font-medium">#{si.number}</span>
                    <span className="text-gray-400">
                      ({Math.round(si.score)}%)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {prediction.status === "pending" && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <button
                onClick={() => handleAction("accept")}
                disabled={isReviewing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isReviewing ? "Processing..." : "Accept"}
              </button>
              <button
                onClick={() => handleAction("edit")}
                disabled={isReviewing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Edit
              </button>
              <button
                onClick={() => handleAction("reject")}
                disabled={isReviewing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Reject
              </button>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {prediction.corrections && prediction.corrections.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                Corrections Made
              </p>
              {prediction.corrections.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">{c.field}:</span>
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
          )}
        </div>
      </div>

      <TriageEditDialog
        open={isEditing}
        onOpenChange={setIsEditing}
        prediction={pred}
        onSubmit={handleEditSubmit}
        isSubmitting={isReviewing}
      />
    </>
  );
}
