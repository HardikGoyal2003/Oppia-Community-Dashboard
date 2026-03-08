import { UserRole } from "@/lib/auth/auth.types";

export interface MemberAccessRequestModel {
  email: string;
  team: string;
  role: UserRole;
  note: string;
  username: string;
  createdAt: Date;
}

export interface MemberAccessRequestsModel {
  pending: MemberAccessRequestModel[];
  responded: MemberAccessRequestModel[];
}

export type MemberAccessDecision = "ACCEPT" | "DECLINE";
