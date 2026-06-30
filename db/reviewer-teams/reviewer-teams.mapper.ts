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

/**
 * Validates that the raw value is a valid AssignedPR.
 *
 * @param pr The raw Firestore value to validate.
 * @param path Dot-delimited error path prefix.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertAssignedPR(
  pr: FirebaseFirestore.DocumentData | null,
  path: string,
): asserts pr is AssignedPR {
  if (pr === null) {
    throw new DbValidationError(path, "Assigned PR must be an object.");
  }

  if (typeof pr.prNumber !== "number") {
    throw new DbValidationError(
      `${path}.prNumber`,
      "Each assigned PR prNumber must be a number.",
    );
  }

  if (typeof pr.title !== "string" || !pr.title.trim()) {
    throw new DbValidationError(
      `${path}.title`,
      "Each assigned PR title must be a non-empty string.",
    );
  }

  if (typeof pr.url !== "string" || !pr.url.trim()) {
    throw new DbValidationError(
      `${path}.url`,
      "Each assigned PR url must be a non-empty string.",
    );
  }

  if (typeof pr.assignedAt !== "string" || !pr.assignedAt.trim()) {
    throw new DbValidationError(
      `${path}.assignedAt`,
      "Each assigned PR assignedAt must be a non-empty string.",
    );
  }
}

/**
 * Validates that the raw value is a valid ReviewerTeamMember.
 *
 * @param member The raw Firestore value to validate.
 * @param index The index of the member in the parent team array.
 * @param teamSlug The slug of the parent team, used for error paths.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertReviewerTeamMember(
  member: FirebaseFirestore.DocumentData | null,
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
        member.assignedPRs[i] as FirebaseFirestore.DocumentData | null,
        `teams[${teamSlug}].members[${index}].assignedPRs[${i}]`,
      );
    }
  }
}

/**
 * Validates that the raw value is a valid ReviewerTeam.
 *
 * @param team The raw Firestore value to validate.
 * @param index The index of the team in the teams array.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertReviewerTeam(
  team: FirebaseFirestore.DocumentData | null,
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
      team.members[i] as FirebaseFirestore.DocumentData | null,
      i,
      team.teamSlug,
    );
  }

  if (team.assignedPRs !== undefined) {
    if (!Array.isArray(team.assignedPRs)) {
      throw new DbValidationError(
        `teams[${index}].assignedPRs`,
        "Reviewer team assignedPRs must be an array.",
      );
    }

    for (let i = 0; i < team.assignedPRs.length; i++) {
      assertAssignedPR(
        team.assignedPRs[i] as FirebaseFirestore.DocumentData | null,
        `teams[${index}].assignedPRs[${i}]`,
      );
    }
  }
}

/**
 * Validates the raw Firestore reviewer teams document shape.
 *
 * @param doc The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
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
    throw new DbValidationError("teams", "Reviewer teams must be an array.");
  }

  for (let i = 0; i < doc.teams.length; i++) {
    assertReviewerTeam(
      doc.teams[i] as FirebaseFirestore.DocumentData | null,
      i,
    );
  }
}

/**
 * Converts a raw Firestore document into a typed ReviewerTeamsDocument.
 *
 * @param doc The raw Firestore document data.
 * @returns The normalized ReviewerTeamsDocument.
 */
export function normalizeReviewerTeamsDocument(
  doc: FirebaseFirestore.DocumentData,
): ReviewerTeamsDocument {
  assertFirestoreReviewerTeamsDocument(doc);

  return {
    platform: doc.platform as ContributionPlatform,
    lastSyncedAt: normalizeTimestamp(doc.lastSyncedAt),
    teams: doc.teams.map(
      (team: FirebaseFirestore.DocumentData) =>
        ({
          teamSlug: team.teamSlug,
          teamName: team.teamName,
          description: team.description,
          assignedPRs:
            (team.assignedPRs as FirebaseFirestore.DocumentData[])?.map(
              (pr) => ({
                prNumber: pr.prNumber,
                title: pr.title,
                url: pr.url,
                assignedAt: (pr.assignedAt ?? pr.waitingSince) as string,
              }),
            ) ?? [],
          members: (team.members as FirebaseFirestore.DocumentData[]).map(
            (member) => ({
              username: member.username,
              avatarUrl: member.avatarUrl,
              assignedPRs:
                (member.assignedPRs as FirebaseFirestore.DocumentData[])?.map(
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

/**
 * Converts a ReviewerTeamsDocument into a Firestore-safe format.
 *
 * @param document The domain document to serialize.
 * @returns The Firestore-ready document with Timestamp fields.
 */
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
      assignedPRs: team.assignedPRs.map((pr) => ({
        prNumber: pr.prNumber,
        title: pr.title,
        url: pr.url,
        assignedAt: pr.assignedAt,
      })),
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
