import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import type {
  PendingReview,
  TeamReviewerEntry,
  TeamReviewersDocument,
} from "@/lib/domain/reviewer-teams.types";

export type FirestoreTeamReviewers = {
  teams: TeamReviewerEntry[];
  lastUpdated: Timestamp;
};

/**
 * Validates that the raw value is a valid PendingReview.
 *
 * @param pr The raw Firestore value to validate.
 * @param path Dot-delimited error path prefix.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertPendingReview(
  pr: FirebaseFirestore.DocumentData | null,
  path: string,
): asserts pr is PendingReview {
  if (pr === null) {
    throw new DbValidationError(path, "Pending review must be an object.");
  }
  if (typeof pr.prNumber !== "number") {
    throw new DbValidationError(
      `${path}.prNumber`,
      "prNumber must be a number.",
    );
  }
  if (typeof pr.title !== "string" || !pr.title.trim()) {
    throw new DbValidationError(
      `${path}.title`,
      "title must be a non-empty string.",
    );
  }
  if (typeof pr.url !== "string" || !pr.url.trim()) {
    throw new DbValidationError(
      `${path}.url`,
      "url must be a non-empty string.",
    );
  }
  if (typeof pr.assignedAt !== "string" || !pr.assignedAt.trim()) {
    throw new DbValidationError(
      `${path}.assignedAt`,
      "assignedAt must be a non-empty string.",
    );
  }
}

/**
 * Validates that the raw value is a valid TeamReviewerEntry.
 *
 * @param team The raw Firestore value to validate.
 * @param index The index of the team in the teams array.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertTeamReviewerEntry(
  team: FirebaseFirestore.DocumentData | null,
  index: number,
): asserts team is TeamReviewerEntry {
  if (team === null) {
    throw new DbValidationError(
      `teams[${index}]`,
      "Team entry must be an object.",
    );
  }
  if (typeof team.teamSlug !== "string" || !team.teamSlug.trim()) {
    throw new DbValidationError(
      `teams[${index}].teamSlug`,
      "teamSlug must be a non-empty string.",
    );
  }
  if (typeof team.teamName !== "string" || !team.teamName.trim()) {
    throw new DbValidationError(
      `teams[${index}].teamName`,
      "teamName must be a non-empty string.",
    );
  }
  if (typeof team.description !== "string") {
    throw new DbValidationError(
      `teams[${index}].description`,
      "description must be a string.",
    );
  }
  if (!Array.isArray(team.members)) {
    throw new DbValidationError(
      `teams[${index}].members`,
      "members must be an array.",
    );
  }
  for (let i = 0; i < team.members.length; i++) {
    const m = team.members[i];
    if (m === null || typeof m !== "object") {
      throw new DbValidationError(
        `teams[${index}].members[${i}]`,
        "Each member must be an object.",
      );
    }
    if (typeof m.username !== "string" || !m.username.trim()) {
      throw new DbValidationError(
        `teams[${index}].members[${i}].username`,
        "username must be a non-empty string.",
      );
    }
    if (typeof m.avatarUrl !== "string" || !m.avatarUrl.trim()) {
      throw new DbValidationError(
        `teams[${index}].members[${i}].avatarUrl`,
        "avatarUrl must be a non-empty string.",
      );
    }
  }
  if (team.teamAssignedPRs !== undefined) {
    if (!Array.isArray(team.teamAssignedPRs)) {
      throw new DbValidationError(
        `teams[${index}].teamAssignedPRs`,
        "teamAssignedPRs must be an array.",
      );
    }
    for (let i = 0; i < team.teamAssignedPRs.length; i++) {
      assertPendingReview(
        team.teamAssignedPRs[i] as FirebaseFirestore.DocumentData | null,
        `teams[${index}].teamAssignedPRs[${i}]`,
      );
    }
  }
}

/**
 * Validates the raw Firestore team-reviewers document shape.
 *
 * @param data The raw Firestore document data.
 * @returns Nothing. Throws when the document shape is invalid.
 */
function assertFirestoreTeamReviewers(
  data: FirebaseFirestore.DocumentData,
): asserts data is FirestoreTeamReviewers {
  if (!Array.isArray(data.teams)) {
    throw new DbValidationError("teams", "teams must be an array.");
  }
  for (let i = 0; i < data.teams.length; i++) {
    assertTeamReviewerEntry(
      data.teams[i] as FirebaseFirestore.DocumentData | null,
      i,
    );
  }
  assertTimestamp("TeamReviewers", "lastUpdated", data.lastUpdated);
}

/**
 * Normalizes a raw Firestore team-reviewers document into the app model.
 *
 * @param data The raw Firestore document data.
 * @returns The normalized team-reviewers document.
 */
export function normalizeTeamReviewers(
  data: FirebaseFirestore.DocumentData,
): TeamReviewersDocument {
  assertFirestoreTeamReviewers(data);
  return {
    teams: data.teams,
    lastUpdated: normalizeTimestamp(data.lastUpdated),
  };
}

/**
 * Serializes a team-reviewers document for Firestore storage.
 *
 * @param doc The document to persist.
 * @returns The Firestore-ready document.
 */
export function serializeTeamReviewers(
  doc: TeamReviewersDocument,
): FirestoreTeamReviewers {
  return {
    teams: doc.teams,
    lastUpdated: Timestamp.fromDate(doc.lastUpdated),
  };
}
