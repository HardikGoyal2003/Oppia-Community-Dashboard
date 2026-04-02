import { Timestamp } from "firebase-admin/firestore";
import type {
  MemberAccessRequestModel,
  MemberAccessRequestRecord,
} from "@/db/member-access-requests/member-access-request.types";
import { DbValidationError } from "@/db/db.errors";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { MemberAccessRequestStatus } from "@/db/member-access-requests/member-access-request.types";

const CONTRIBUTION_PLATFORMS: ContributionPlatform[] = ["WEB", "ANDROID"];
const MEMBER_ACCESS_REQUEST_STATUSES: MemberAccessRequestStatus[] = [
  "PENDING",
  "ACCEPTED",
  "REJECTED",
];

export type FirestoreMemberAccessRequest = Omit<
  MemberAccessRequestModel,
  "createdAt"
> & {
  createdAt: Timestamp;
};

/**
 * Validates the raw Firestore member-access request document shape.
 *
 * @param request The raw Firestore member-access request document data.
 * @returns Nothing. Throws when the request document shape is invalid.
 */
function assertFirestoreMemberAccessRequest(
  request: FirebaseFirestore.DocumentData,
): asserts request is FirestoreMemberAccessRequest {
  if (typeof request.userId !== "string") {
    throw new DbValidationError(
      "userId",
      "Member access request userId must be a string.",
    );
  }

  if (typeof request.team !== "string") {
    throw new DbValidationError(
      "team",
      "Member access request team must be a string.",
    );
  }

  if (typeof request.role !== "string") {
    throw new DbValidationError(
      "role",
      "Member access request role must be a string.",
    );
  }

  if (typeof request.note !== "string") {
    throw new DbValidationError(
      "note",
      "Member access request note must be a string.",
    );
  }

  if (typeof request.username !== "string") {
    throw new DbValidationError(
      "username",
      "Member access request username must be a string.",
    );
  }

  if (!CONTRIBUTION_PLATFORMS.includes(request.platform)) {
    throw new DbValidationError(
      "platform",
      "Member access request platform must be WEB or ANDROID.",
    );
  }

  if (!MEMBER_ACCESS_REQUEST_STATUSES.includes(request.status)) {
    throw new DbValidationError(
      "status",
      "Member access request status must be PENDING, ACCEPTED, or REJECTED.",
    );
  }

  assertTimestamp("Member access request", "createdAt", request.createdAt);
}

/**
 * Normalizes a Firestore member-access request document into the app model.
 *
 * @param request The raw Firestore member-access request document.
 * @returns The normalized member-access request model.
 */
export function normalizeMemberAccessRequest(
  request: FirestoreMemberAccessRequest,
): MemberAccessRequestModel {
  return {
    userId: request.userId,
    platform: request.platform,
    team: request.team,
    role: request.role,
    note: request.note,
    username: request.username,
    status: request.status,
    createdAt: normalizeTimestamp(request.createdAt),
  };
}

/**
 * Normalizes raw Firestore member-access request document data into the app model.
 *
 * @param request The raw Firestore member-access request document data.
 * @returns The normalized member-access request model.
 */
export function normalizeMemberAccessRequestDocument(
  request: FirebaseFirestore.DocumentData,
): MemberAccessRequestModel {
  assertFirestoreMemberAccessRequest(request);
  return normalizeMemberAccessRequest(request);
}

/**
 * Normalizes a Firestore member-access request document plus id into the app record model.
 *
 * @param id The Firestore document id.
 * @param request The raw Firestore member-access request document data.
 * @returns The normalized member-access request record.
 */
export function normalizeMemberAccessRequestRecord(
  id: string,
  request: FirebaseFirestore.DocumentData,
): MemberAccessRequestRecord {
  return {
    id,
    ...normalizeMemberAccessRequestDocument(request),
  };
}

/**
 * Serializes a member-access request model for Firestore storage.
 *
 * @param request The normalized member-access request model.
 * @returns The Firestore-ready member-access request document.
 */
export function serializeMemberAccessRequest(
  request: MemberAccessRequestModel,
): FirestoreMemberAccessRequest {
  return {
    ...request,
    createdAt: Timestamp.fromDate(request.createdAt),
  };
}
