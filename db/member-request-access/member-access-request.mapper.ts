import { Timestamp } from "firebase-admin/firestore";
import type { MemberAccessRequestModel } from "@/db/member-request-access/member-request-access.types";
import { normalizeTimestamp } from "@/db/timestamp.utils";

export type FirestoreMemberAccessRequest = Omit<
  MemberAccessRequestModel,
  "createdAt"
> & {
  createdAt: Timestamp;
};

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

export function serializeMemberAccessRequest(
  request: MemberAccessRequestModel,
): FirestoreMemberAccessRequest {
  return {
    ...request,
    createdAt: Timestamp.fromDate(request.createdAt),
  };
}
