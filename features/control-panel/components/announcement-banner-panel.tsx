"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type AnnouncementBannerData = {
  title: string;
  message: string;
  isEnabled: boolean;
  updatedAt: string | null;
};

export function AnnouncementBannerPanel() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);

      try {
        const response = await fetch("/api/announcements", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load announcement banner.");
        }

        const data = (await response.json()) as {
          announcement: AnnouncementBannerData;
        };

        setTitle(data.announcement.title);
        setMessage(data.announcement.message);
        setIsEnabled(data.announcement.isEnabled);
        setUpdatedAt(data.announcement.updatedAt);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load announcement banner.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch("/api/announcements", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          message,
          isEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save announcement banner.");
      }

      setUpdatedAt(new Date().toISOString());
      setSuccessMessage("Announcement banner updated.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save announcement banner.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Announcement Banner
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create and enable a single global announcement visible across the
            app.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(event) => setIsEnabled(event.target.checked)}
            disabled={loading || saving}
            className="h-4 w-4 rounded border-slate-300"
          />
          Enabled
        </label>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Title
          </label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="🚧 Scheduled maintenance:"
            disabled={loading || saving}
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Message
          </label>
          <Textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            placeholder="Our website will be temporarily unavailable on [date] from [start time] to [end time]. Thank you for your understanding."
            disabled={loading || saving}
          />
        </div>
      </div>

      {updatedAt && (
        <p className="mt-4 text-xs text-slate-500">
          Last updated: {new Date(updatedAt).toLocaleString("en-IN")}
        </p>
      )}

      {errorMessage && (
        <p className="mt-4 text-sm text-red-600">{errorMessage}</p>
      )}

      {successMessage && (
        <p className="mt-4 text-sm text-emerald-700">{successMessage}</p>
      )}

      <div className="mt-6">
        <Button onClick={handleSave} disabled={loading || saving}>
          {saving ? "Saving..." : "Save Announcement"}
        </Button>
      </div>
    </section>
  );
}
