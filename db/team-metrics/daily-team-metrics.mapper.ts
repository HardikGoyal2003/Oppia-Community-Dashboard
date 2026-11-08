import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyTeamMetric } from "@/lib/domain/daily-team-metrics.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";
import {
  SCHEMA_KEYS,
  assertSchemaVersion,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { migrateDocument } from "@/db/schema/schema-migrations";

export type FirestoreDailyTeamMetric = Omit<DailyTeamMetric, "capturedAt"> & {
  capturedAt: Timestamp;
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
 * Validates the raw Firestore team-metric document shape.
 *
 * @param metric The raw Firestore team metric data.
 * @returns Nothing. Throws when the stored shape is invalid.
 */
function assertFirestoreDailyTeamMetric(
  metric: FirebaseFirestore.DocumentData,
): asserts metric is FirestoreDailyTeamMetric {
  if (typeof metric.teamId !== "string" || !metric.teamId.trim()) {
    throw new DbValidationError(
      "teamId",
      "Team metric teamId must be a non-empty string.",
    );
  }

  if (typeof metric.teamName !== "string" || !metric.teamName.trim()) {
    throw new DbValidationError(
      "teamName",
      "Team metric teamName must be a non-empty string.",
    );
  }

  if (metric.platform !== "WEB" && metric.platform !== "ANDROID") {
    throw new DbValidationError(
      "platform",
      "Team metric platform must be WEB or ANDROID.",
    );
  }

  if (typeof metric.dateKey !== "string" || !metric.dateKey.trim()) {
    throw new DbValidationError(
      "dateKey",
      "Team metric dateKey must be a non-empty string.",
    );
  }

  if (typeof metric.unansweredIssuesCount !== "number") {
    throw new DbValidationError(
      "unansweredIssuesCount",
      "Team metric unansweredIssuesCount must be a number.",
    );
  }

  assertNonNegativeNumber(metric.maxWaitingDays, "maxWaitingDays");
  assertTimestamp("Team metric", "capturedAt", metric.capturedAt);
  assertSchemaVersion(SCHEMA_KEYS.DAILY_TEAM_METRICS, metric.schemaVersion);
}

/**
 * Normalizes raw Firestore team metric data into the app model.
 *
 * @param metric The raw Firestore team metric data.
 * @returns The normalized team metric.
 */
export function normalizeDailyTeamMetricDocument(
  metric: FirebaseFirestore.DocumentData,
): DailyTeamMetric {
  const migratedMetric = migrateDocument(
    SCHEMA_KEYS.DAILY_TEAM_METRICS,
    metric,
  );
  assertFirestoreDailyTeamMetric(migratedMetric);

  return {
    capturedAt: normalizeTimestamp(migratedMetric.capturedAt),
    dateKey: migratedMetric.dateKey,
    maxWaitingDays: migratedMetric.maxWaitingDays,
    platform: migratedMetric.platform as ContributionPlatform,
    teamId: migratedMetric.teamId,
    teamName: migratedMetric.teamName,
    unansweredIssuesCount: migratedMetric.unansweredIssuesCount,
    schemaVersion: migratedMetric.schemaVersion,
  };
}

/**
 * Serializes a team metric for Firestore storage.
 *
 * @param metric The normalized team metric.
 * @returns The Firestore-ready team metric document.
 */
export function serializeDailyTeamMetric(
  metric: Omit<DailyTeamMetric, "schemaVersion">,
): FirestoreDailyTeamMetric {
  return {
    capturedAt: Timestamp.fromDate(metric.capturedAt),
    dateKey: metric.dateKey,
    maxWaitingDays: metric.maxWaitingDays,
    platform: metric.platform,
    teamId: metric.teamId,
    teamName: metric.teamName,
    unansweredIssuesCount: metric.unansweredIssuesCount,
    schemaVersion: getCurrentSchemaVersion(SCHEMA_KEYS.DAILY_TEAM_METRICS),
  };
}
