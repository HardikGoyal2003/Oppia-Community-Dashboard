import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  AssignedPR,
  ReviewerTeam,
  ReviewerTeamMember,
  ReviewerTeamsDocument,
} from "@/lib/domain/reviewer-teams.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type FirestoreReviewerTeamsDocument = Omit<
  ReviewerTeamsDocument,
  "lastSyncedAt"
> & {
  lastSyncedAt: Timestamp;
};

function assertAssignedPR(
  pr: Record<string, unknown> | null,
  index: number,
  username: string,
): asserts pr is AssignedPR {
  if (pr === null) {
    throw new DbValidationError(
      `members[${username}].assignedPRs[${index}]`,
      "Assigned PR must be an object.",
    );
  }

  if (typeof pr.prNumber !== "number") {
    throw new DbValidationError(
      `members[${username}].assignedPRs[${index}].prNumber`,
      "Each assigned PR prNumber must be a number.",
    );
  }

  if (typeof pr.title !== "string" || !pr.title.trim()) {
    throw new DbValidationError(
      `members[${username}].assignedPRs[${index}].title`,
      "Each assigned PR title must be a non-empty string.",
    );
  }

  if (typeof pr.url !== "string" || !pr.url.trim()) {
    throw new DbValidationError(
      `members[${username}].assignedPRs[${index}].url`,
      "Each assigned PR url must be a non-empty string.",
    );
  }

  if (typeof pr.assignedAt !== "string" || !pr.assignedAt.trim()) {
    throw new DbValidationError(
      `members[${username}].assignedPRs[${index}].assignedAt`,
      "Each assigned PR assignedAt must be a non-empty string.",
    );
  }
}

function assertReviewerTeamMember(
  member: Record<string, unknown> | null,
  index: number,
  teamSlug: string,
): asserts member is ReviewerTeamMember {
  if (member === null) {
    throw new DbValidationError(
      `teams[${teamSlug}].members[${index}]`,
      "Reviewer team member must be an object.",
    );
  }

  if (typeof member.username !== "string" || !member.username.trim()) {
    throw new DbValidationError(
      `teams[${teamSlug}].members[${index}].username`,
      "Each reviewer team member username must be a non-empty string.",
    );
  }

  if (typeof member.avatarUrl !== "string" || !member.avatarUrl.trim()) {
    throw new DbValidationError(
      `teams[${teamSlug}].members[${index}].avatarUrl`,
      "Each reviewer team member avatarUrl must be a non-empty string.",
    );
  }

  if (member.assignedPRs !== undefined) {
    if (!Array.isArray(member.assignedPRs)) {
      throw new DbValidationError(
        `teams[${teamSlug}].members[${index}].assignedPRs`,
        "Reviewer team member assignedPRs must be an array.",
      );
    }

    for (let i = 0; i < member.assignedPRs.length; i++) {
      assertAssignedPR(
        member.assignedPRs[i] as Record<string, unknown> | null,
        i,
        member.username,
      );
    }
  }
}

function assertReviewerTeam(
  team: Record<string, unknown> | null,
  index: number,
): asserts team is ReviewerTeam {
  if (team === null) {
    throw new DbValidationError(
      `teams[${index}]`,
      "Reviewer team must be an object.",
    );
  }

  if (typeof team.teamSlug !== "string" || !team.teamSlug.trim()) {
    throw new DbValidationError(
      `teams[${index}].teamSlug`,
      "Each reviewer team teamSlug must be a non-empty string.",
    );
  }

  if (typeof team.teamName !== "string" || !team.teamName.trim()) {
    throw new DbValidationError(
      `teams[${index}].teamName`,
      "Each reviewer team teamName must be a non-empty string.",
    );
  }

  if (typeof team.description !== "string") {
    throw new DbValidationError(
      `teams[${index}].description`,
      "Each reviewer team description must be a string.",
    );
  }

  if (!Array.isArray(team.members)) {
    throw new DbValidationError(
      `teams[${index}].members`,
      "Reviewer team members must be an array.",
    );
  }

  for (let i = 0; i < team.members.length; i++) {
    assertReviewerTeamMember(
      team.members[i] as Record<string, unknown> | null,
      i,
      team.teamSlug,
    );
  }
}

function assertFirestoreReviewerTeamsDocument(
  doc: FirebaseFirestore.DocumentData,
): asserts doc is FirestoreReviewerTeamsDocument {
  if (doc.platform !== "WEB" && doc.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Reviewer teams platform must be WEB or ANDROID.",
    );
  }

  assertTimestamp("ReviewerTeams", "lastSyncedAt", doc.lastSyncedAt);

  if (!Array.isArray(doc.teams)) {
    throw new DbValidationError(
      "teams",
      "Reviewer teams must be an array.",
    );
  }

  for (let i = 0; i < doc.teams.length; i++) {
    assertReviewerTeam(
      doc.teams[i] as Record<string, unknown> | null,
      i,
    );
  }
}

export function normalizeReviewerTeamsDocument(
  doc: FirebaseFirestore.DocumentData,
): ReviewerTeamsDocument {
  assertFirestoreReviewerTeamsDocument(doc);

  return {
    platform: doc.platform as ContributionPlatform,
    lastSyncedAt: normalizeTimestamp(doc.lastSyncedAt),
    teams: doc.teams.map(
      (team: Record<string, unknown>) =>
        ({
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          description: team.description,
          members: (team.members as Record<string, unknown>[]).map(
            (member) => ({
              username: member.username,
              avatarUrl: member.avatarUrl,
              assignedPRs: (member.assignedPRs as Record<string, unknown>[])?.map(
                (pr) => ({
                  prNumber: pr.prNumber,
                  title: pr.title,
                  url: pr.url,
                  assignedAt: (pr.assignedAt ?? pr.waitingSince) as string,
                }),
              ) ?? [],
            }),
          ),
        }) as ReviewerTeam,
    ),
  };
}

export function serializeReviewerTeamsDocument(
  document: ReviewerTeamsDocument,
): FirestoreReviewerTeamsDocument {
  return {
    platform: document.platform,
    lastSyncedAt: Timestamp.fromDate(document.lastSyncedAt),
    teams: document.teams.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((member) => ({
        username: member.username,
        avatarUrl: member.avatarUrl,
        assignedPRs: member.assignedPRs.map((pr) => ({
          prNumber: pr.prNumber,
          title: pr.title,
          url: pr.url,
          assignedAt: pr.assignedAt,
        })),
      })),
    })),
  };
}
