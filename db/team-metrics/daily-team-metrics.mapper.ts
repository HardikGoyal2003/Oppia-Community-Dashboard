import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type { DailyTeamMetric } from "@/lib/domain/daily-team-metrics.types";
import {
  assertTimestamp,
  normalizeTimestamp,
} from "@/db/utils/timestamp.utils";

export type FirestoreDailyTeamMetric = Omit<DailyTeamMetric, "capturedAt"> & {
  capturedAt: Timestamp;
};

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

  assertTimestamp("Team metric", "capturedAt", metric.capturedAt);
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
  assertFirestoreDailyTeamMetric(metric);

  return {
    capturedAt: normalizeTimestamp(metric.capturedAt),
    dateKey: metric.dateKey,
    platform: metric.platform as ContributionPlatform,
    teamId: metric.teamId,
    teamName: metric.teamName,
    unansweredIssuesCount: metric.unansweredIssuesCount,
  };
}

/**
 * Serializes a team metric for Firestore storage.
 *
 * @param metric The normalized team metric.
 * @returns The Firestore-ready team metric document.
 */
export function serializeDailyTeamMetric(
  metric: DailyTeamMetric,
): FirestoreDailyTeamMetric {
  return {
    capturedAt: Timestamp.fromDate(metric.capturedAt),
    dateKey: metric.dateKey,
    platform: metric.platform,
    teamId: metric.teamId,
    teamName: metric.teamName,
    unansweredIssuesCount: metric.unansweredIssuesCount,
  };
}
