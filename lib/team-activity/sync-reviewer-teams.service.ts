import { fetchWebReviewerTeams, fetchAssignedPRs } from "@/lib/github/github.fetcher";
import { getReviewerTeamsDocument, upsertReviewerTeamsDocument } from "@/db/reviewer-teams/reviewer-teams.db";
import type { ReviewerTeamsDocument } from "@/lib/domain/reviewer-teams.types";

type SyncSummary = {
  platform: string;
  syncedTeamsCount: number;
  totalMembersCount: number;
};

export async function syncReviewerTeams(): Promise<SyncSummary> {
  const [fetchedTeams, currentPRs, existingDoc] = await Promise.all([
    fetchWebReviewerTeams(),
    fetchAssignedPRs(),
    getReviewerTeamsDocument("WEB"),
  ]);

  const totalMembersCount = fetchedTeams.reduce(
    (sum, team) => sum + team.members.length,
    0,
  );

  const document: ReviewerTeamsDocument = {
    platform: "WEB",
    lastSyncedAt: new Date(),
    teams: fetchedTeams.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((member) => {
        const existingMember = findExistingMember(existingDoc, member.username);
        const existingMap = buildExistingPRMap(existingMember);
        const now = new Date().toISOString();

        const currentAssignments = currentPRs.get(member.username) ?? [];

        return {
          username: member.username,
          avatarUrl: member.avatarUrl,
          assignedPRs: currentAssignments.map((pr) => ({
            prNumber: pr.prNumber,
            title: pr.title,
            url: pr.url,
            assignedAt: existingMap.get(pr.prNumber) ?? now,
          })),
        };
      }),
    })),
  };

  await upsertReviewerTeamsDocument(document);

  return {
    platform: "WEB",
    syncedTeamsCount: fetchedTeams.length,
    totalMembersCount,
  };
}

function findExistingMember(
  doc: ReviewerTeamsDocument | null,
  username: string,
) {
  if (!doc) return null;
  for (const team of doc.teams) {
    const member = team.members.find((m) => m.username === username);
    if (member) return member;
  }
  return null;
}

function buildExistingPRMap(
  member: { assignedPRs: { prNumber: number; assignedAt: string }[] } | null,
): Map<number, string> {
  const map = new Map<number, string>();
  if (member) {
    for (const pr of member.assignedPRs) {
      map.set(pr.prNumber, pr.assignedAt);
    }
  }
  return map;
}
