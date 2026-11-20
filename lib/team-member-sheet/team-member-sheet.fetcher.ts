import { parse } from "csv-parse/sync";
import { buildTeamMemberSheetCsvUrl } from "@/lib/config/team-member-sheet.constants";
import type { TeamMemberSheetSource } from "@/lib/config/team-member-sheet.constants";
import type { TeamMemberSheetMember } from "@/lib/team-member-sheet/team-member-sheet.types";

/** Maximum time allowed for one public sheet request. */
const FETCH_TIMEOUT_MS = 15_000;

/** Column names used to locate fields in the sheet's header row. */
const COLUMNS = {
  email: ["email"],
  fullName: ["full name"],
  githubUsername: ["github username", "githubusername"],
  status: ["status"],
} as const;

type SheetColumn = keyof typeof COLUMNS;

/**
 * Normalizes a sheet header for matching.
 *
 * Sheet headers contain line breaks followed by notes, so only the first line
 * is used and whitespace is collapsed.
 *
 * @param value The raw header text.
 * @returns The normalized header text.
 */
function normalizeHeader(value: string): string {
  return value.split("\n")[0].replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Locates the required columns in the sheet header row.
 *
 * @param headers The parsed header row.
 * @param teamKey The team key used in error messages.
 * @returns The index of every required column.
 */
function getColumnIndexes(
  headers: string[],
  teamKey: string,
): Record<SheetColumn, number> {
  const normalizedHeaders = headers.map(normalizeHeader);
  const indexes = {} as Record<SheetColumn, number>;

  for (const column of Object.keys(COLUMNS) as SheetColumn[]) {
    const index = normalizedHeaders.findIndex((header) =>
      COLUMNS[column].some((alias) => header === alias),
    );

    if (index === -1) {
      throw new Error(
        `Team member sheet for ${teamKey} is missing the "${column}" column.`,
      );
    }

    indexes[column] = index;
  }

  return indexes;
}

/**
 * Reads a trimmed cell value from a parsed CSV row.
 *
 * @param row The parsed CSV row.
 * @param index The column index.
 * @returns The trimmed cell value.
 */
function getCell(row: string[], index: number): string {
  return (row[index] ?? "").trim();
}

/**
 * Checks whether a sheet status marks someone as currently listed.
 *
 * A word boundary is required so `Inactive` does not match `active`.
 *
 * @param status The sheet status value.
 * @returns True when the status marks a listed member.
 */
function isListedStatus(status: string): boolean {
  return /\bactive\b/i.test(status);
}

/**
 * Fetches the listed members of one team's public Google Sheet.
 *
 * @param source The team member sheet to read.
 * @returns The listed members with a non-empty GitHub username.
 */
export async function fetchTeamMemberSheet(
  source: TeamMemberSheetSource,
): Promise<TeamMemberSheetMember[]> {
  const url = buildTeamMemberSheetCsvUrl(source);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Team member sheet request for ${source.teamKey} failed with HTTP ${response.status}.`,
    );
  }

  const rows = parse(await response.text(), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];

  if (rows.length === 0) {
    throw new Error(`Team member sheet for ${source.teamKey} is empty.`);
  }

  const indexes = getColumnIndexes(rows[0], source.teamKey);
  const members: TeamMemberSheetMember[] = [];
  const seenUsernames = new Set<string>();

  for (const row of rows.slice(1)) {
    const status = getCell(row, indexes.status);
    const githubUsername = getCell(row, indexes.githubUsername);

    if (!isListedStatus(status) || !githubUsername) {
      continue;
    }

    const normalizedUsername = githubUsername.toLowerCase();

    if (seenUsernames.has(normalizedUsername)) {
      continue;
    }

    seenUsernames.add(normalizedUsername);
    members.push({
      email: getCell(row, indexes.email),
      fullName: getCell(row, indexes.fullName),
      githubUsername,
      status,
    });
  }

  return members;
}
