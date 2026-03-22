"use client";

import { useEffect, useState } from "react";
import { Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DataJobDefinition,
  DataJobRun,
} from "@/lib/domain/data-jobs.types";

type DataJobsResponse = {
  jobs: DataJobDefinition[];
  runs: DataJobRun[];
};

function formatTimestamp(value: string | Date | null): string {
  if (!value) {
    return "Not finished";
  }

  return new Date(value).toLocaleString("en-IN");
}

function getStatusClassName(status: DataJobRun["status"]): string {
  switch (status) {
    case "SUCCEEDED":
      return "bg-emerald-100 text-emerald-800";
    case "FAILED":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-800";
  }
}

export function DataJobsPanel() {
  const [jobs, setJobs] = useState<DataJobDefinition[]>([]);
  const [runs, setRuns] = useState<DataJobRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobKey, setRunningJobKey] = useState<string | null>(null);
  const [selectedJobKey, setSelectedJobKey] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<DataJobRun | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async (): Promise<DataJobsResponse | null> => {
    setLoading(true);

    try {
      const response = await fetch("/api/data-jobs", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load data jobs.");
      }

      const data = (await response.json()) as DataJobsResponse;
      setJobs(data.jobs);
      setRuns(data.runs);
      setSelectedJobKey(
        (currentValue) => currentValue || data.jobs[0]?.key || "",
      );
      return data;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load data jobs.",
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleRunJob = async () => {
    if (!selectedJobKey) {
      return;
    }

    const selectedJob = jobs.find((job) => job.key === selectedJobKey);

    setRunningJobKey(selectedJobKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/data-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobKey: selectedJobKey,
        }),
      });

      await response.json();

      if (!response.ok) {
        const refreshedData = await loadData();
        const latestRun = refreshedData?.runs.find(
          (run) => run.jobKey === selectedJobKey,
        );

        if (latestRun) {
          setSelectedRun(latestRun);
        }

        throw new Error("Data job failed. See run output for details.");
      }

      setSuccessMessage(
        `${selectedJob?.name ?? "Data job"} completed successfully.`,
      );
      await loadData();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to run data job.",
      );
    } finally {
      setRunningJobKey(null);
    }
  };

  const detailTabLabel = selectedRun?.status === "FAILED" ? "Error" : "Output";
  const detailContent =
    selectedRun?.status === "FAILED"
      ? selectedRun.errorMessage || "No error output was captured."
      : selectedRun?.summary || "No output was captured.";

  const handleCopyOutput = async () => {
    try {
      await navigator.clipboard.writeText(detailContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to copy output.",
      );
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Data Jobs</h2>
          <p className="mt-2 text-sm text-slate-600">
            Run admin-only audits, backfills, and maintenance tasks against
            Firestore data.
          </p>
        </div>
      </div>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {successMessage && (
        <p className="text-sm text-emerald-700">{successMessage}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-sm font-medium text-slate-700">
              Select job
            </p>
            <Select value={selectedJobKey} onValueChange={setSelectedJobKey}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Select a data job" />
              </SelectTrigger>
              <SelectContent>
                {jobs.map((job) => (
                  <SelectItem key={job.key} value={job.key}>
                    {job.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            className="mt-6 md:mt-7"
            onClick={handleRunJob}
            disabled={loading || !selectedJobKey || runningJobKey !== null}
          >
            <Play className="mr-2 h-4 w-4" />
            {runningJobKey ? "Running..." : "Run Job"}
          </Button>
        </div>

        {selectedJobKey && (
          <p className="mt-3 text-sm text-slate-600">
            {jobs.find((job) => job.key === selectedJobKey)?.description}
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-900">Recent Runs</h3>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="p-3 text-left">Job Name</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Started</th>
                <th className="p-3 text-left">Finished</th>
                <th className="p-3 text-left">Take Action</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td className="p-4 text-slate-500" colSpan={5}>
                    No data job runs yet.
                  </td>
                </tr>
              )}

              {runs.map((run) => (
                <tr key={run.id} className="border-t border-slate-200">
                  <td className="p-3">
                    <div className="font-medium text-slate-900">
                      {run.jobName}
                    </div>
                    <div className="text-xs text-slate-500">{run.jobKey}</div>
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusClassName(
                        run.status,
                      )}`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3">{formatTimestamp(run.startedAt)}</td>
                  <td className="p-3">{formatTimestamp(run.finishedAt)}</td>
                  <td className="p-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRun(run)}
                    >
                      View Output
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        open={Boolean(selectedRun)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRun(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Data Job Run Details</DialogTitle>
          </DialogHeader>

          {selectedRun && (
            <div className="max-h-[75vh] space-y-6 overflow-y-auto pr-1">
              <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Job Name
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedRun.jobName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Id
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedRun.id}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Started
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatTimestamp(selectedRun.startedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Finished
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {formatTimestamp(selectedRun.finishedAt)}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                    <button
                      type="button"
                      className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                    >
                      {detailTabLabel}
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyOutput}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>

                <div className="mt-3 max-h-[40vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
                    {detailContent}
                  </pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </section>
  );
}
