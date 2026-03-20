export type MemberAccessDecision = "ACCEPT" | "DECLINE";

export type MemberAccessRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED";

export interface MemberAccessRequestModel {
  email: string;
  team: string;
  role: string;
  note: string;
  username: string;
  status: MemberAccessRequestStatus;
  createdAt: Date;
}
