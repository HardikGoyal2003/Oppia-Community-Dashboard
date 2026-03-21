import { Timestamp } from "firebase-admin/firestore";
import type { MemberAccessRequestModel } from "@/db/member-request-access/member-request-access.types";
import { normalizeTimestamp } from "@/db/timestamp.utils";

export type FirestoreMemberAccessRequest = Omit<
  MemberAccessRequestModel,
  "createdAt"
> & {
  createdAt: Timestamp;
};

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
    email: request.email,
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
