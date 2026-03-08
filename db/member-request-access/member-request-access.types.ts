export type MemberAccessDecision = "ACCEPT" | "DECLINE";

export interface MemberAccessRequestModel {
  email: string;
  team: string;
  role: string;
  note: string;
  username: string;
  createdAt: Date;
}

export interface MemberAccessRequestsModel {
  pending: MemberAccessRequestModel[];
  responded: MemberAccessRequestModel[];
}
