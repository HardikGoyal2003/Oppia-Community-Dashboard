import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { SchemaVersioned } from "@/lib/domain/schema.types";

/** Why a roster member does not currently have a usable dashboard account. */
export type UnregisteredMemberReason = "NOT_REGISTERED" | "ALUMNI_ACCOUNT";

/** Lifecycle state of a roster reconciliation item. */
export type UnregisteredMemberState = "OPEN" | "RESOLVED";

/** Why an item was closed by the daily sync. */
export type UnregisteredMemberResolution = "REGISTERED" | "LEFT_ROSTER";

/**
 * A person listed as active in a team roster who has no active dashboard
 * account. Stored at `unregisteredMembers/{teamKey}__{normalizedUsername}`.
 */
export type UnregisteredMemberModel = SchemaVersioned & {
  teamKey: string;
  platform: ContributionPlatform;
  /** Username exactly as written in the roster. */
  githubUsername: string;
  /** Lowercased, trimmed username used for matching and the document id. */
  normalizedUsername: string;
  email: string;
  fullName: string;
  /** Status value from the roster sheet. */
  sheetStatus: string;
  reason: UnregisteredMemberReason;
  state: UnregisteredMemberState;
  /** When the person was first flagged as missing. */
  createdAt: Date;
  /** When the roster was last reconciled for this person. */
  updatedAt: Date;
  resolvedAt: Date | null;
  resolution: UnregisteredMemberResolution | null;
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
