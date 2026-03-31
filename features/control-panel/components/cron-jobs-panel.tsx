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
  CronJobDefinition,
  CronJobRunResult,
} from "@/lib/domain/cron-jobs.types";

type CronJobsResponse = {
  jobs: CronJobDefinition[];
};

function formatTimestamp(value: string | Date): string {
  return new Date(value).toLocaleString("en-IN");
}

export function CronJobsPanel() {
  const [jobs, setJobs] = useState<CronJobDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobKey, setRunningJobKey] = useState<string | null>(null);
  const [selectedJobKey, setSelectedJobKey] = useState<string>("");
  const [selectedRun, setSelectedRun] = useState<CronJobRunResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Loads the dev-only cron jobs exposed by the API.
   *
   * @returns The loaded cron jobs response when successful.
   */
  const loadData = async (): Promise<CronJobsResponse | null> => {
    setLoading(true);

    try {
      const response = await fetch("/api/cron-jobs", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Failed to load cron jobs.");
      }

      const data = (await response.json()) as CronJobsResponse;
      setJobs(data.jobs);
      setSelectedJobKey(
        (currentValue) => currentValue || data.jobs[0]?.key || "",
      );
      return data;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load cron jobs.",
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

    setRunningJobKey(selectedJobKey);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/cron-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobKey: selectedJobKey,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        run?: CronJobRunResult;
      };

      if (!response.ok || !data.run) {
        throw new Error(data.error || "Failed to run cron job.");
      }

      setSelectedRun(data.run);
      setSuccessMessage(`${data.run.jobName} completed successfully.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to run cron job.",
      );
    } finally {
      setRunningJobKey(null);
    }
  };

  const handleCopyOutput = async () => {
    if (!selectedRun) {
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedRun.summary);
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
          <h2 className="text-lg font-semibold text-slate-900">Cron Jobs</h2>
          <p className="mt-2 text-sm text-slate-600">
            Trigger scheduled jobs manually while developing the dashboard. This
            panel is hidden outside development mode.
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
                <SelectValue placeholder="Select a cron job" />
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
            <DialogTitle>Cron Job Run Details</DialogTitle>
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
                    Key
                  </p>
                  <p className="mt-1 text-sm text-slate-900">
                    {selectedRun.jobKey}
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
                      Output
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
                    {selectedRun.summary}
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
