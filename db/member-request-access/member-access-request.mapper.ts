import { Timestamp } from "firebase-admin/firestore";
import type { MemberAccessRequestModel } from "@/db/member-request-access/member-request-access.types";

export type FirestoreMemberAccessRequest = Omit<
  MemberAccessRequestModel,
  "createdAt"
> & {
  createdAt: Timestamp;
};

export function normalizeMemberAccessRequest(
  request: FirestoreMemberAccessRequest
): MemberAccessRequestModel {
  return {
    email: request.email,
    team: request.team,
    role: request.role,
    note: request.note,
    username: request.username,
    status: request.status,
    createdAt:
      request.createdAt instanceof Timestamp
        ? request.createdAt.toDate()
        : new Date(),
  };
}

export function serializeMemberAccessRequest(
  request: MemberAccessRequestModel
): FirestoreMemberAccessRequest {
  return {
    ...request,
    createdAt: Timestamp.fromDate(request.createdAt),
  };
}
