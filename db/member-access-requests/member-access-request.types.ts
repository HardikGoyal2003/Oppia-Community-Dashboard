import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

export type MemberAccessDecision = "ACCEPT" | "DECLINE";

export type MemberAccessRequestStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface MemberAccessRequestModel extends SchemaVersioned {
  userId: string;
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
