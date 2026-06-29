import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
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
          members: (team.members as Record<string, unknown>[]).map(
            (member) => ({
              username: member.username,
              avatarUrl: member.avatarUrl,
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
      members: team.members.map((member) => ({
        username: member.username,
        avatarUrl: member.avatarUrl,
      })),
    })),
  };
}
