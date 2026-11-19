import { parse } from "csv-parse/sync";
import { buildTeamRosterCsvUrl } from "@/lib/config/team-roster.constants";
import type { TeamRosterSource } from "@/lib/config/team-roster.constants";
import type { TeamRosterMember } from "@/lib/team-roster/team-roster.types";

/** Maximum time allowed for one public sheet request. */
const FETCH_TIMEOUT_MS = 15_000;

/** Column names used to locate fields in the roster's header row. */
const COLUMNS = {
  email: ["email"],
  fullName: ["full name"],
  githubUsername: ["github username", "githubusername"],
  status: ["status"],
} as const;

type RosterColumn = keyof typeof COLUMNS;

/**
 * Normalizes a sheet header for matching.
 *
 * Roster headers contain line breaks followed by notes, so only the first
 * line is used and whitespace is collapsed.
 *
 * @param value The raw header text.
 * @returns The normalized header text.
 */
function normalizeHeader(value: string): string {
  return value.split("\n")[0].replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Locates the required columns in the roster header row.
 *
 * @param headers The parsed header row.
 * @param teamKey The team key used in error messages.
 * @returns The index of every required column.
 */
function getColumnIndexes(
  headers: string[],
  teamKey: string,
): Record<RosterColumn, number> {
  const normalizedHeaders = headers.map(normalizeHeader);
  const indexes = {} as Record<RosterColumn, number>;

  for (const column of Object.keys(COLUMNS) as RosterColumn[]) {
    const index = normalizedHeaders.findIndex((header) =>
      COLUMNS[column].some((alias) => header === alias),
    );

    if (index === -1) {
      throw new Error(
        `Roster sheet for ${teamKey} is missing the "${column}" column.`,
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
 * Checks whether a roster status marks someone as currently active.
 *
 * A word boundary is required so `Inactive` does not match `active`.
 *
 * @param status The roster status value.
 * @returns True when the status marks an active member.
 */
function isActiveStatus(status: string): boolean {
  return /\bactive\b/i.test(status);
}

/**
 * Fetches the active members of one team's public Google Sheet roster.
 *
 * @param source The roster sheet to read.
 * @returns The active roster members with a non-empty GitHub username.
 */
export async function fetchTeamRoster(
  source: TeamRosterSource,
): Promise<TeamRosterMember[]> {
  const url = buildTeamRosterCsvUrl(source);
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Roster sheet request for ${source.teamKey} failed with HTTP ${response.status}.`,
    );
  }

  const rows = parse(await response.text(), {
    bom: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as string[][];

  if (rows.length === 0) {
    throw new Error(`Roster sheet for ${source.teamKey} is empty.`);
  }

  const indexes = getColumnIndexes(rows[0], source.teamKey);
  const members: TeamRosterMember[] = [];
  const seenUsernames = new Set<string>();

  for (const row of rows.slice(1)) {
    const status = getCell(row, indexes.status);
    const githubUsername = getCell(row, indexes.githubUsername);

    if (!isActiveStatus(status) || !githubUsername) {
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
