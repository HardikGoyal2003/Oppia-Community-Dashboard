import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

/**
 * A person listed as active in a team roster who has no active dashboard
 * account. Documents exist only while the gap is open; the daily sync deletes
 * them as soon as the person registers or leaves the active roster.
 * Stored at `unregisteredMembers/{teamKey}__{normalizedUsername}`.
 */
export type UnregisteredMemberModel = SchemaVersioned & {
  teamKey: string;
  platform: ContributionPlatform;
  /** Username exactly as written in the roster. */
  githubUsername: string;
  email: string;
  fullName: string;
  /** When the person was first flagged as missing. */
  createdAt: Date;
  /** When the roster was last reconciled for this person. */
  updatedAt: Date;
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
