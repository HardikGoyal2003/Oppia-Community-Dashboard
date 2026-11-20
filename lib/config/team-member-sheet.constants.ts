import type { ContributionPlatform } from "@/lib/auth/auth.types";

/** A public Google Sheet that lists the members of one team. */
export type TeamMemberSheetSource = {
  /** Google Sheets tab id from the sheet URL (`gid`). */
  gid: string;
  /** Platform of the team, matching the value stored on user records. */
  platform: ContributionPlatform;
  /** Document id of the Google Sheet. */
  sheetId: string;
  /** Team key stored on user records (for example `CORE`). */
  teamKey: string;
};

/**
 * Builds the public CSV export URL for a team member sheet and tab.
 *
 * @param source The team member sheet source.
 * @returns The CSV export URL.
 */
export function buildTeamMemberSheetCsvUrl(
  source: TeamMemberSheetSource,
): string {
  return `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    source.sheetId,
  )}/export?format=csv&gid=${encodeURIComponent(source.gid)}`;
}

/**
 * Public team member sheets that the daily sync reconciles against dashboard
 * users. Android sheets are intentionally excluded until they are shared
 * publicly.
 */
export const TEAM_MEMBER_SHEET_SOURCES: readonly TeamMemberSheetSource[] =
  Object.freeze([
    {
      gid: "1343008932",
      platform: "WEB",
      sheetId: "1nLZzxt6kPshgW2bplK-O1FTG19H-imL9DaQl25m11J4",
      teamKey: "LEAP",
    },
    {
      gid: "600132579",
      platform: "WEB",
      sheetId: "1WIeSvjHKuOye9-M2jZO2l8eZq_kWlK9JxgsNKWOdwwo",
      teamKey: "CORE",
    },
    {
      gid: "967433820",
      platform: "WEB",
      sheetId: "1k5mG41HFnu2nd3E9R_5V8l8vZmGuDgtlQDY-kraGsyo",
      teamKey: "DEV_WORKFLOW",
    },
  ]);

// Android team member sheets are not enabled yet because these sheets are not
// publicly readable. Add them to TEAM_MEMBER_SHEET_SOURCES once sharing is fixed:
// CLAM: sheetId "119ntv1K2quL3WDpJEyTCRxAid16_TQcChz7zOsMbpGA", gid "55778895"
// DEV_WORKFLOW_INFRA: sheetId "1J-dPilXpAWc1rHc3er92U2_YoVlyb7IzxZuoXEk7eog", gid "2045371656"
