"use client";

import { useEffect, useState } from "react";
import { Users, Shield, Clock, RefreshCw } from "lucide-react";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";

export function ReviewerTeamsTab() {
  const [data, setData] = useState<ReviewerTeamsDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/reviewer-teams", { cache: "no-store" });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load reviewer teams.");
        }

        const doc = (await res.json()) as ReviewerTeamsDocument;
        setData(doc);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
        <Shield className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-4 text-lg font-semibold text-slate-700">
          No reviewer teams data
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Run the &quot;Sync Reviewer Teams&quot; cron job from the control panel
          to populate this view.
        </p>
      </div>
    );
  }

  const totalMembers = data.teams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Reviewer Teams
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Web sub-teams and their members synced from GitHub.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {new Date(data.lastSyncedAt).toLocaleString("en-IN")}
          </span>
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-medium text-slate-600">
            WEB
          </span>
        </div>
      </div>

      <div className="grid gap-4">
        {data.teams.map((team) => (
          <div
            key={team.teamSlug}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
                  <Users className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {team.teamName}
                  </h2>
                  {team.description && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {team.description}
                    </p>
                  )}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {team.members.length}{" "}
                {team.members.length === 1 ? "member" : "members"}
              </span>
            </div>

            {team.members.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {team.members.map((member) => (
                  <div
                    key={member.username}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <img
                      src={member.avatarUrl}
                      alt={member.username}
                      className="h-8 w-8 rounded-full"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      @{member.username}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-6 text-center text-sm text-slate-400">
                No members in this team.
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          <strong className="font-medium text-slate-700">{data.teams.length}</strong> teams,{" "}
          <strong className="font-medium text-slate-700">{totalMembers}</strong> total members.
          Synced every 7 days via cron.
        </p>
      </div>
    </div>
  );
}
