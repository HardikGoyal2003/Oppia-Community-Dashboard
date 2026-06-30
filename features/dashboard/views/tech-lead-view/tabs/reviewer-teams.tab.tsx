"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  RefreshCw,
  Shield,
  Users,
} from "lucide-react";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";

type Tab = "individual" | "teams";

function waitingSince(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return `${days}d ${remaining}h`;
}

function IndividualView({ data }: { data: ReviewerTeamsDocument }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const members = useMemo(() => {
    const seen = new Map<
      string,
      {
        username: string;
        avatarUrl: string;
        reviewsDone: number;
        avgReviewTimeHours: number | null;
      }
    >();
    for (const team of data.teams) {
      for (const m of team.members) {
        if (!seen.has(m.username)) {
          seen.set(m.username, {
            username: m.username,
            avatarUrl: m.avatarUrl,
            reviewsDone: m.reviewsDone,
            avgReviewTimeHours: m.avgReviewTimeHours,
          });
        }
      }
    }
    return Array.from(seen.values()).sort((a, b) =>
      a.username.localeCompare(b.username),
    );
  }, [data]);

  const memberPRMap = useMemo(() => {
    const map = new Map<
      string,
      (typeof data.teams)[0]["members"][0]["assignedPRs"]
    >();
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                  prs.length > 0
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {prs.length} PR{prs.length !== 1 ? "s" : ""}
              </span>
            </button>

            <div className="flex justify-center gap-4 border-t border-slate-100 px-4 py-3 text-xs">
              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  {member.reviewsDone}
                </p>
                <p className="text-slate-500">Reviews done</p>
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-800">
                  {member.avgReviewTimeHours !== null
                    ? `${member.avgReviewTimeHours}h`
                    : "—"}
                </p>
                <p className="text-slate-500">Avg time</p>
              </div>
            </div>

            {isExpanded && prs.length > 0 && (
              <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
                {prs.map((pr) => (
                  <div
                    key={pr.prNumber}
                    className="flex items-center gap-2 px-4 py-2.5"
                  >
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      #{pr.prNumber}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                    <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
                      {pr.title}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {waitingSince(pr.assignedAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}

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
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(
    new Set(),
  );

  function toggleMember(key: string) {
    setExpandedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
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
              {team.members.map((member) => {
                const key = `${team.teamSlug}/${member.username}`;
                const isExpanded = expandedMembers.has(key);
                const count = member.assignedPRs.length;

                return (
                  <div key={member.username}>
                    <button
                      type="button"
                      onClick={() => toggleMember(key)}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="h-8 w-8 shrink-0 rounded-full"
                      />
                      <span className="text-sm font-medium text-slate-700">
                        @{member.username}
                      </span>
                      <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                        {count > 0 && (
                          <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-medium text-amber-700">
                            {count} PR{count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && count > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50">
                        {member.assignedPRs.map((pr) => (
                          <div
                            key={pr.prNumber}
                            className="flex items-center gap-3 px-5 py-2.5 pl-16"
                          >
                            <a
                              href={pr.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                            >
                              #{pr.prNumber}
                              <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                            <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
                              {pr.title}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                              <Clock className="h-3 w-3" />
                              {waitingSince(pr.assignedAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {isExpanded && count === 0 && (
                      <div className="border-t border-slate-100 px-5 py-4 pl-16 text-center text-sm text-slate-400">
                        No PRs assigned for review.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-sm text-slate-400">
              No members in this team.
            </div>
          )}
        </div>
      ))}
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

  const totalAssignedPRs = useMemo(
    () =>
      data?.teams.reduce(
        (sum, team) =>
          sum +
          team.members.reduce((msum, m) => msum + m.assignedPRs.length, 0),
        0,
      ) ?? 0,
    [data],
  );

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
          Run the &quot;Sync Reviewer Reports&quot; cron job from the control
          panel to populate this view.
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3">
        <p className="text-xs text-slate-500">
          <strong className="font-medium text-slate-700">
            {data.teams.length}
          </strong>{" "}
          teams,{" "}
          <strong className="font-medium text-slate-700">
            {totalAssignedPRs}
          </strong>{" "}
          open PRs awaiting review. Synced every 7 days via cron.
        </p>
      </div>
    </div>
  );
}
