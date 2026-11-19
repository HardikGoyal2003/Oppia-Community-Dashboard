import type { ContributionPlatform } from "@/lib/auth/auth.types";

/**
 * Platform currently synced by the reviewer reports pipeline.
 *
 * The DB layer is platform-aware: every persisted reviewer model carries a
 * `platform` field and platform-prefixed document ids, so Android data can be
 * added without rewriting existing documents. Only the GitHub fetchers and
 * cron entry points remain Web-only; they can be parameterized without any
 * schema change or migration.
 */
export const REVIEWER_REPORT_PLATFORM: ContributionPlatform = "WEB";
