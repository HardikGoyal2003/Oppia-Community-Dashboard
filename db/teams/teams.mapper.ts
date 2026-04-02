import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  TeamGfiCounts,
  TeamLead,
  TeamLeadRole,
  TeamModel,
} from "@/lib/domain/teams.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type FirestoreTeam = Omit<TeamModel, "lastUpdated"> & {
  lastUpdated: Timestamp;
};

/**
 * Validates that a numeric field is present and non-negative.
 *
 * @param value The numeric value candidate.
 * @param field The Firestore field name being validated.
 * @returns Nothing. Throws when the value is invalid.
 */
function assertNonNegativeNumber(
  value: number | undefined,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || Number.isNaN(value) || value < 0) {
    throw new DbValidationError(
      field,
      `${field} must be a non-negative number.`,
    );
  }
}

/**
 * Validates the nested GFI counts object stored on a team document.
 *
 * @param gfiCounts The nested gfiCounts object candidate.
 * @returns Nothing. Throws when the nested shape is invalid.
 */
function assertFirestoreGfiCounts(
  gfiCounts: Record<string, number | undefined> | null,
): asserts gfiCounts is TeamGfiCounts {
  if (gfiCounts === null) {
    throw new DbValidationError(
      "gfiCounts",
      "Team gfiCounts must be an object.",
    );
  }

  const counts = gfiCounts;

  assertNonNegativeNumber(counts.frontend, "gfiCounts.frontend");
  assertNonNegativeNumber(counts.backend, "gfiCounts.backend");
  assertNonNegativeNumber(counts.fullstack, "gfiCounts.fullstack");
  assertNonNegativeNumber(counts.uncategorized, "gfiCounts.uncategorized");
}

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
    if (typeof lead.uid !== "string" || !lead.uid.trim()) {
      throw new DbValidationError(
        "leads.uid",
        "Each team lead uid must be a non-empty string.",
      );
    }

    if (typeof lead.username !== "string" || !lead.username.trim()) {
      throw new DbValidationError(
        "leads.username",
        "Each team lead username must be a non-empty string.",
      );
    }

    if (lead.role !== "TEAM_LEAD" && lead.role !== "LEAD_TRAINEE") {
      throw new DbValidationError(
        "leads.role",
        "Each team lead role must be TEAM_LEAD or LEAD_TRAINEE.",
      );
    }
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
  if (typeof team.teamName !== "string" || !team.teamName.trim()) {
    throw new DbValidationError(
      "teamName",
      "Team teamName must be a non-empty string.",
    );
  }

  if (team.platform !== "WEB" && team.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Team platform must be WEB or ANDROID.",
    );
  }

  assertFirestoreTeamLeads(team.leads);
  assertFirestoreGfiCounts(team.gfiCounts);

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
  assertFirestoreTeam(team);

  return {
    gfiCounts: {
      backend: team.gfiCounts.backend,
      frontend: team.gfiCounts.frontend,
      fullstack: team.gfiCounts.fullstack,
      uncategorized: team.gfiCounts.uncategorized,
    },
    lastUpdated: normalizeTimestamp(team.lastUpdated),
    leads: team.leads.map((lead) => ({
      role: lead.role as TeamLeadRole,
      uid: lead.uid,
      username: lead.username,
    })),
    platform: team.platform as ContributionPlatform,
    teamName: team.teamName,
  };
}

/**
 * Serializes a team model for Firestore storage.
 *
 * @param team The normalized team model.
 * @returns The Firestore-ready team document.
 */
export function serializeTeam(
  team: Omit<TeamModel, "lastUpdated"> & { lastUpdated: Date | Timestamp },
): FirestoreTeam {
  return {
    gfiCounts: {
      backend: team.gfiCounts.backend,
      frontend: team.gfiCounts.frontend,
      fullstack: team.gfiCounts.fullstack,
      uncategorized: team.gfiCounts.uncategorized,
    },
    leads: team.leads.map((lead) => ({
      role: lead.role,
      uid: lead.uid,
      username: lead.username,
    })),
    lastUpdated:
      team.lastUpdated instanceof Timestamp
        ? team.lastUpdated
        : Timestamp.fromDate(team.lastUpdated),
    platform: team.platform,
    teamName: team.teamName,
  };
}
