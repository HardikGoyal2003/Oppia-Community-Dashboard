"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import type {
  PendingReview,
  ReviewerTeamsDocument,
  ReviewerTeamMember,
} from "@/lib/domain/reviewer-teams.types";
import {
  PendingReviewRows,
  ReviewerStats,
} from "@/features/dashboard/shared/reviewer-reports/reviewer-report-parts";
import { ReviewerAnalyticsSection } from "../components/reviewer-analytics-section";

type Tab = "individual" | "teams";

function IndividualView({ data }: { data: ReviewerTeamsDocument }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const members = useMemo(() => {
    const seen = new Map<string, ReviewerTeamMember>();
    for (const team of data.teams) {
      for (const m of team.members) {
        if (!seen.has(m.username)) {
          seen.set(m.username, m);
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.username.localeCompare(b.username),
    );
  }, [data]);

  const memberPRMap = useMemo(() => {
    const map = new Map<string, PendingReview[]>();
    for (const team of data.teams) {
      for (const m of team.members) {
        const existing = map.get(m.username) ?? [];
        const seenPRs = new Set(existing.map((p) => p.prNumber));
        for (const pr of m.assignedPRs) {
          if (!seenPRs.has(pr.prNumber)) {
            existing.push(pr);
            seenPRs.add(pr.prNumber);
          }
        }
        map.set(m.username, existing);
      }
    }
    return map;
  }, [data]);

  function toggle(username: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => {
        const isExpanded = expanded.has(member.username);
        const prs = memberPRMap.get(member.username) ?? [];

        return (
          <div
            key={member.username}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggle(member.username)}
              className="flex w-full flex-col items-center gap-2 px-4 py-5 text-center hover:bg-slate-50"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={member.avatarUrl}
                alt={member.username}
                className="h-14 w-14 rounded-full"
              />
              <span className="text-sm font-semibold text-slate-800">
                @{member.username}
              </span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  member.pendingStaleCount > 0
                    ? "bg-red-50 text-red-700"
                    : prs.length > 0
                      ? "bg-amber-50 text-amber-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {prs.length} PR{prs.length !== 1 ? "s" : ""}
                {member.pendingStaleCount > 0
                  ? ` · ${member.pendingStaleCount} stale`
                  : ""}
              </span>
            </button>

            <ReviewerStats reviewer={member} />

            {isExpanded && prs.length > 0 && <PendingReviewRows prs={prs} />}

            {isExpanded && prs.length === 0 && (
              <div className="border-t border-slate-100 px-4 py-4 text-center text-sm text-slate-400">
                No PRs assigned.
              </div>
            )}
          </div>
        );
      })}
      {members.length === 0 && (
        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">No reviewers found.</p>
        </div>
      )}
    </div>
  );
}

function TeamsView({ data }: { data: ReviewerTeamsDocument }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set(),
  );

  function toggleTeam(slug: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleMember(key: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {data.teams.map((team) => {
        const isExpanded = expanded.has(team.teamSlug);
        const hasMembers = team.members.length > 0;

        return (
          <div
            key={team.teamSlug}
            className="rounded-xl border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => toggleTeam(team.teamSlug)}
              className="flex w-full flex-col items-center gap-2 px-4 py-5 text-center hover:bg-slate-50"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100">
                <Users className="h-6 w-6 text-slate-600" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                {team.teamName}
              </span>
              {team.description && (
                <p className="line-clamp-2 text-xs text-slate-500">
                  {team.description}
                </p>
              )}
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                {team.members.length}{" "}
                {team.members.length === 1 ? "member" : "members"}
              </span>
            </button>

            {hasMembers && (
              <div className="flex flex-wrap justify-center gap-2 border-t border-slate-100 px-4 py-3">
                {team.members.slice(0, 4).map((m) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={m.username}
                    src={m.avatarUrl}
                    alt={m.username}
                    title={`@${m.username}`}
                    className="h-8 w-8 rounded-full border-2 border-white"
                  />
                ))}
                {team.members.length > 4 && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                    +{team.members.length - 4}
                  </span>
                )}
              </div>
            )}

            {isExpanded && (
              <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
                {team.members.map((member) => {
                  const key = `${team.teamSlug}/${member.username}`;
                  const isMemberExpanded = expandedMembers.has(key);
                  const count = member.assignedPRs.length;

                  return (
                    <div key={member.username}>
                      <button
                        type="button"
                        onClick={() => toggleMember(key)}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left hover:bg-slate-100"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={member.avatarUrl}
                          alt={member.username}
                          className="h-6 w-6 shrink-0 rounded-full"
                        />
                        <span className="text-xs font-medium text-slate-700">
                          @{member.username}
                        </span>
                        <div className="ml-auto flex items-center gap-1.5">
                          {member.pendingStaleCount > 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              {member.pendingStaleCount} stale
                            </span>
                          )}
                          {count > 0 && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                              {count}
                            </span>
                          )}
                          {isMemberExpanded ? (
                            <ChevronDown className="h-3 w-3 text-slate-400" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-slate-400" />
                          )}
                        </div>
                      </button>

                      {isMemberExpanded && count > 0 && (
                        <PendingReviewRows prs={member.assignedPRs} compact />
                      )}

                      {isMemberExpanded && count === 0 && (
                        <div className="border-t border-slate-100 px-4 py-3 pl-8 text-center text-[11px] text-slate-400">
                          No PRs assigned.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isExpanded && !hasMembers && (
              <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
                No members in this team.
              </div>
            )}
          </div>
        );
      })}
      {data.teams.length === 0 && (
        <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">No teams found.</p>
        </div>
      )}
    </div>
  );
}

export function ReviewerReportsTab() {
  const [data, setData] = useState<ReviewerTeamsDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("individual");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/reviewer-teams", { cache: "no-store" });

        if (!res.ok) {
          const body = (await res.json()) as { error?: string };
          throw new Error(body.error ?? "Failed to load reviewer reports.");
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

  const totalAssignedPRs = useMemo(() => {
    if (!data) return 0;

    const seen = new Set<string>();
    for (const team of data.teams) {
      for (const member of team.members) {
        for (const pr of member.assignedPRs) {
          seen.add(`${member.username.toLowerCase()}:${pr.prNumber}`);
        }
      }
    }

    return seen.size;
  }, [data]);

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
          No reviewer reports data
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Run the &quot;Sync Reviewer Teams&quot; cron job, or generate reviewer
          dummy data from the control panel to populate this view.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Reviewer Reports
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

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setTab("individual")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "individual"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Individual
        </button>
        <button
          type="button"
          onClick={() => setTab("teams")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === "teams"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Teams
        </button>
      </div>

      {tab === "individual" ? (
        <IndividualView data={data} />
      ) : (
        <TeamsView data={data} />
      )}

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Reviewer analytics
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review velocity, participation, concentration, and PR-size trends
            across all stored review cycles.
          </p>
        </div>
        <ReviewerAnalyticsSection analytics={data.analytics} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          <strong className="font-medium text-slate-700">
            {data.teams.length}
          </strong>{" "}
          teams,{" "}
          <strong className="font-medium text-slate-700">
            {totalAssignedPRs}
          </strong>{" "}
          open PRs awaiting review. Synced daily via cron.
        </p>
      </div>
    </div>
  );
}
