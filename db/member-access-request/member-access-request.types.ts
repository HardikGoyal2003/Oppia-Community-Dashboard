import type { ContributionPlatform } from "@/lib/auth/auth.types";

export type MemberAccessDecision = "ACCEPT" | "DECLINE";

export type MemberAccessRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface MemberAccessRequestModel {
  userId: string;
  email: string;
  platform: ContributionPlatform;
  team: string;
  role: string;
  note: string;
  username: string;
  status: MemberAccessRequestStatus;
  createdAt: Date;
}

export interface MemberAccessRequestRecord extends MemberAccessRequestModel {
  id: string;
}
