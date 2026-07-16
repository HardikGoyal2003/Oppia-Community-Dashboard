"use client";

import { useState } from "react";
import type {
  AIPrediction,
  TriageCorrection,
} from "@/lib/issue-triage/issue-triage.types";
import {
  TRIAGE_TEAMS,
  TRIAGE_REPOSITORIES,
  TRIAGE_LABELS,
  TRIAGE_CUJS,
  TRIAGE_PRIORITIES,
  TRIAGE_SEVERITIES,
} from "@/lib/issue-triage/issue-triage.types";

interface TriageEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prediction: AIPrediction;
  onSubmit: (corrections: TriageCorrection[]) => Promise<void>;
  isSubmitting: boolean;
}

type FieldEditorProps = {
  label: string;
  field: string;
  predicted: string | string[] | boolean;
  options?: readonly string[];
  isMulti?: boolean;
  onChange: (field: string, value: string | string[] | boolean) => void;
};

function FieldEditor({
  label,
  field,
  predicted,
  options,
  isMulti,
  onChange,
}: FieldEditorProps) {
  const [isChanged, setIsChanged] = useState(false);
  const [value, setValue] = useState<string | string[] | boolean>(predicted);

  const handleChange = (newValue: string | string[] | boolean) => {
    setValue(newValue);
    setIsChanged(JSON.stringify(newValue) !== JSON.stringify(predicted));
    onChange(field, newValue);
  };

  const displayPredicted = Array.isArray(predicted)
    ? predicted.join(", ")
    : String(predicted);

  return (
    <div
      className={`rounded-lg border p-3 ${isChanged ? "border-blue-300 bg-blue-50" : "border-gray-200"}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        {isChanged && (
          <span className="text-xs text-blue-600 font-medium">Edited</span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-2">
        Predicted: <span className="text-gray-500">{displayPredicted}</span>
      </p>

      {isMulti ? (
        <div className="flex flex-wrap gap-1.5">
          {(options || []).map((opt) => {
            const isSelected = Array.isArray(value) && value.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  const current = Array.isArray(value) ? [...value] : [];
                  const next = isSelected
                    ? current.filter((v: string) => v !== opt)
                    : [...current, opt];
                  handleChange(next);
                }}
                className={`rounded-md px-2.5 py-1 text-xs font-medium border cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <select
          value={String(value)}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        >
          {(options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export function TriageEditDialog({
  open,
  onOpenChange,
  prediction,
  onSubmit,
  isSubmitting,
}: TriageEditDialogProps) {
  const [corrections, setCorrections] = useState<
    {
      field: string;
      predicted: string | string[] | boolean;
      corrected: string | string[] | boolean;
    }[]
  >([]);
  const [reason, setReason] = useState("");

  if (!open) return null;

  const handleFieldChange = (
    field: string,
    predicted: string | string[] | boolean,
    corrected: string | string[] | boolean,
  ) => {
    setCorrections((prev) => {
      const filtered = prev.filter((c) => c.field !== field);
      if (JSON.stringify(corrected) === JSON.stringify(predicted)) {
        return filtered;
      }
      return [...filtered, { field, predicted, corrected }];
    });
  };

  const handleSubmit = async () => {
    await onSubmit(corrections);
    setCorrections([]);
    setReason("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-2xl rounded-xl bg-white shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Edit Triage Prediction
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            <svg
              className="h-5 w-5"
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
          </button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-500">
            Correct any fields the AI got wrong. Only changed fields will be
            saved.
          </p>

          <FieldEditor
            label="Labels"
            field="labels"
            predicted={prediction.labels}
            options={[...TRIAGE_LABELS]}
            isMulti
            onChange={(_, value) =>
              handleFieldChange("labels", prediction.labels, value)
            }
          />

          <FieldEditor
            label="Team"
            field="team"
            predicted={prediction.team}
            options={[...TRIAGE_TEAMS]}
            onChange={(_, value) =>
              handleFieldChange("team", prediction.team, value)
            }
          />

          <FieldEditor
            label="Repository"
            field="repository"
            predicted={prediction.repository}
            options={[...TRIAGE_REPOSITORIES]}
            onChange={(_, value) =>
              handleFieldChange("repository", prediction.repository, value)
            }
          />

          <FieldEditor
            label="CUJ"
            field="cuj"
            predicted={prediction.cuj}
            options={[...TRIAGE_CUJS]}
            onChange={(_, value) =>
              handleFieldChange("cuj", prediction.cuj, value)
            }
          />

          <FieldEditor
            label="Good First Issue"
            field="goodFirstIssue"
            predicted={prediction.goodFirstIssue}
            options={["Yes", "No"]}
            onChange={(_, value) =>
              handleFieldChange(
                "goodFirstIssue",
                prediction.goodFirstIssue,
                value === "Yes",
              )
            }
          />

          <FieldEditor
            label="Priority"
            field="priority"
            predicted={prediction.priority}
            options={[...TRIAGE_PRIORITIES]}
            onChange={(_, value) =>
              handleFieldChange("priority", prediction.priority, value)
            }
          />

          <FieldEditor
            label="Severity"
            field="severity"
            predicted={prediction.severity}
            options={[...TRIAGE_SEVERITIES]}
            onChange={(_, value) =>
              handleFieldChange("severity", prediction.severity, value)
            }
          />

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              Why did you make these changes?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional: Explain why the AI prediction was incorrect..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? "Saving..." : "Submit Corrections"}
          </button>
        </div>

        {corrections.length > 0 && (
          <div className="px-6 pb-4">
            <p className="text-xs text-gray-400 mb-2">Changes to be saved:</p>
            {corrections.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 text-xs text-gray-600"
              >
                <span className="font-medium">{c.field}:</span>
                <span className="text-red-500 line-through">
                  {Array.isArray(c.predicted)
                    ? c.predicted.join(", ")
                    : String(c.predicted)}
                </span>
                <span>→</span>
                <span className="text-green-600 font-medium">
                  {Array.isArray(c.corrected)
                    ? c.corrected.join(", ")
                    : String(c.corrected)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
