"use client";

import { useState } from "react";
import { Copy, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DummyDataPanel() {
  const [loading, setLoading] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/dev/dummy-data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          generatorKey: "team_reports",
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        summary?: string;
      };

      if (!response.ok || !data.summary) {
        throw new Error(data.error || "Failed to generate dummy data.");
      }

      setOutput(data.summary);
      setSuccessMessage("Dummy data generated successfully.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to generate dummy data.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOutput = async () => {
    if (!output) {
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
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
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Dummy Data</h2>
        <p className="mt-2 text-sm text-slate-600">
          Generate deterministic sample team metadata and daily team metric
          snapshots for local UI development.
        </p>
      </div>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
      {successMessage && (
        <p className="text-sm text-emerald-700">{successMessage}</p>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-700">
          This writes sample records for `teams` and `dailyTeamMetrics` so the
          Team Reports tab has enough data to render charts and recommendations.
        </p>

        <Button className="mt-4" onClick={handleGenerate} disabled={loading}>
          <DatabaseZap className="mr-2 h-4 w-4" />
          {loading ? "Generating..." : "Generate Team Reports Dummy Data"}
        </Button>
      </div>

      <Dialog
        open={Boolean(output)}
        onOpenChange={(open) => {
          if (!open) {
            setOutput(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dummy Data Output</DialogTitle>
          </DialogHeader>

          {output && (
            <div className="space-y-4">
              <div className="flex justify-end">
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

              <div className="max-h-[40vh] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4">
                <pre className="whitespace-pre-wrap break-words text-sm text-slate-700">
                  {output}
                </pre>
              </div>
            </div>
          )}

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </section>
  );
}
