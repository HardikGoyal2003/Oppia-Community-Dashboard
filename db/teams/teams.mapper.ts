import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { TeamLead, TeamMember, TeamModel } from "@/lib/domain/teams.types";
import {
  assertTimestamp,
  normalizeTimestamp,
  toFirestoreTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  assertNonEmptyString,
  assertNonNegativeNumber,
} from "@/db/utils/validation.utils";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type FirestoreTeam = Omit<TeamModel, "lastUpdated"> & {
  lastUpdated: Timestamp;
};

/**
 * Validates the nested team leads array stored on a team document.
 *
 * @param leads The nested leads array candidate.
 * @returns Nothing. Throws when the nested shape is invalid.
 */
function assertFirestoreTeamLeads(
  leads: Array<Record<string, string | undefined>> | null,
): asserts leads is TeamLead[] {
  if (!Array.isArray(leads)) {
    throw new DbValidationError("leads", "Team leads must be an array.");
  }

  for (const lead of leads) {
    assertNonEmptyString(
      "leads.uid",
      lead.uid,
      "Each team lead uid must be a non-empty string.",
    );
    assertNonEmptyString(
      "leads.username",
      lead.username,
      "Each team lead username must be a non-empty string.",
    );

    if (lead.role !== "TEAM_LEAD" && lead.role !== "LEAD_TRAINEE") {
      throw new DbValidationError(
        "leads.role",
        "Each team lead role must be TEAM_LEAD or LEAD_TRAINEE.",
      );
    }
  }
}

/**
 * Validates the nested team members array stored on a team document.
 *
 * @param members The nested members array candidate.
 * @returns Nothing. Throws when the nested shape is invalid.
 */
function assertFirestoreTeamMembers(
  members: Array<Record<string, string | undefined>> | null,
): asserts members is TeamMember[] {
  if (!Array.isArray(members)) {
    throw new DbValidationError("members", "Team members must be an array.");
  }

  for (const member of members) {
    assertNonEmptyString(
      "members.uid",
      member.uid,
      "Each team member uid must be a non-empty string.",
    );
    assertNonEmptyString(
      "members.username",
      member.username,
      "Each team member username must be a non-empty string.",
    );
  }
}

/**
 * Validates the raw Firestore team document shape.
 *
 * @param team The raw Firestore team data.
 * @returns Nothing. Throws when the stored shape is invalid.
 */
function assertFirestoreTeam(
  team: FirebaseFirestore.DocumentData,
): asserts team is FirestoreTeam {
  assertNonEmptyString(
    "teamName",
    team.teamName,
    "Team teamName must be a non-empty string.",
  );

  if (team.platform !== "WEB" && team.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Team platform must be WEB or ANDROID.",
    );
  }

  assertFirestoreTeamLeads(team.leads);
  assertFirestoreTeamMembers(team.members);
  assertNonNegativeNumber(
    "gfiCount",
    team.gfiCount,
    "gfiCount must be a non-negative number.",
  );

  assertTimestamp("Team", "lastUpdated", team.lastUpdated);
}

/**
 * Normalizes raw Firestore team data into the app model.
 *
 * @param team The raw Firestore team data.
 * @returns The normalized team model.
 */
export function normalizeTeamDocument(
  team: FirebaseFirestore.DocumentData,
): TeamModel {
  const migratedTeam = migrateDocument(SCHEMA_KEYS.TEAMS, team);
  assertFirestoreTeam(migratedTeam);

  return {
    gfiCount: migratedTeam.gfiCount,
    lastUpdated: normalizeTimestamp(migratedTeam.lastUpdated),
    leads: migratedTeam.leads.map((lead) => ({
      role: lead.role,
      uid: lead.uid,
      username: lead.username,
    })),
    members: migratedTeam.members.map((member) => ({
      uid: member.uid,
      username: member.username,
    })),
    platform: migratedTeam.platform,
    teamName: migratedTeam.teamName,
    schemaVersion: migratedTeam.schemaVersion,
  };
}

/**
 * Serializes a team model for Firestore storage.
 *
 * @param team The normalized team model.
 * @returns The Firestore-ready team document.
 */
export function serializeTeam(
  team: Omit<TeamModel, "lastUpdated" | "schemaVersion"> & {
    lastUpdated: Date | Timestamp;
  },
): FirestoreTeam {
  return {
    gfiCount: team.gfiCount,
    leads: team.leads.map((lead) => ({
      role: lead.role,
      uid: lead.uid,
      username: lead.username,
    })),
    members: team.members.map((member) => ({
      uid: member.uid,
      username: member.username,
    })),
    lastUpdated: toFirestoreTimestamp(team.lastUpdated),
    platform: team.platform,
    teamName: team.teamName,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.TEAMS),
  };
}
