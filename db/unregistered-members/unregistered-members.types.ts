import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

/**
 * A person listed in a team member sheet who has no dashboard account.
 * Documents exist only while the gap is open; the daily sync deletes them as
 * soon as the person registers or leaves the team member sheet.
 * Stored at `unregisteredMembers/{teamKey}__{normalizedUsername}`.
 */
export type UnregisteredMemberModel = SchemaVersioned & {
  teamKey: string;
  platform: ContributionPlatform;
  githubUsername: string;
  email: string;
  fullName: string;
  /** When the person was first flagged as missing. */
  createdAt: Date;
};

export type UnregisteredMemberRecord = UnregisteredMemberModel & {
  id: string;
};

/** Payload accepted by the DB layer; the serializer assigns schemaVersion. */
export type UnregisteredMemberWrite = Omit<
  UnregisteredMemberModel,
  "schemaVersion"
> & {
  id: string;
};
