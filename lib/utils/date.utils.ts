/** A value accepted by the shared date parsing helpers. */
export type DateInput = string | number | Date | null | undefined;

/**
 * Parses a date-like value into a `Date`, applying a single invalid-date policy.
 *
 * External timestamps (GitHub payloads, Firestore documents, cached data) may be
 * missing or malformed. Callers should handle `null` instead of propagating
 * `NaN` into filtering, sorting, or metric calculations.
 *
 * @param value The date-like value to parse.
 * @returns The parsed date, or null when the value is missing or invalid.
 */
export function parseDateValue(value: DateInput): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parses a date-like value into epoch milliseconds.
 *
 * @param value The date-like value to parse.
 * @returns The timestamp in milliseconds, or null when missing or invalid.
 */
export function parseTimestampMs(value: DateInput): number | null {
  return parseDateValue(value)?.getTime() ?? null;
}

/**
 * Compares two date-like values.
 *
 * @param left The left date-like value.
 * @param right The right date-like value.
 * @returns A negative, zero, or positive comparison result, or null when either
 *   value is missing or invalid.
 */
export function compareDateInputs(
  left: DateInput,
  right: DateInput,
): number | null {
  const leftMs = parseTimestampMs(left);
  const rightMs = parseTimestampMs(right);

  if (leftMs === null || rightMs === null) {
    return null;
  }

  return leftMs - rightMs;
}

/**
 * Formats a day of month with its English ordinal suffix.
 *
 * @param day The day of month to format.
 * @returns The ordinal day string such as `1st` or `22nd`.
 */
export function getOrdinalDay(day: number): string {
  const remainder = day % 10;
  const teen = day % 100;

  if (teen >= 11 && teen <= 13) {
    return `${day}th`;
  }

  if (remainder === 1) {
    return `${day}st`;
  }

  if (remainder === 2) {
    return `${day}nd`;
  }

  if (remainder === 3) {
    return `${day}rd`;
  }

  return `${day}th`;
}

/**
 * Formats a date into the IST-normalized YYYY-MM-DD reporting bucket.
 *
 * @param date The timestamp to format.
 * @returns The Asia/Kolkata date key.
 */
export function getIstDateKey(date: Date): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Kolkata",
    year: "numeric",
  });

  return formatter.format(date);
}

/**
 * Builds an IST-normalized YYYY-MM-DD date key for a relative day offset from now.
 *
 * @param days The number of days to subtract from the current date.
 * @returns The Asia/Kolkata date key for the requested day.
 */
export function getIstDateKeyDaysAgo(days: number): string {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - days);

  return getIstDateKey(target);
}

/**
 * Builds the IST-normalized YYYY-MM-DD date key of the Monday that starts the
 * week containing the given date. Useful as a stable weekly idempotency bucket.
 *
 * @param date The timestamp to anchor the week to.
 * @returns The Asia/Kolkata date key for the week's Monday.
 */
export function getIstWeekStartDateKey(date: Date): string {
  const [year, month, day] = getIstDateKey(date)
    .split("-")
    .map((part) => Number(part));

  const istMidnight = new Date(Date.UTC(year, month - 1, day));
  const daysSinceMonday = (istMidnight.getUTCDay() + 6) % 7;

  istMidnight.setUTCDate(istMidnight.getUTCDate() - daysSinceMonday);

  return istMidnight.toISOString().slice(0, 10);
}

/**
 * Formats the elapsed time between now and a past timestamp into a compact label.
 *
 * @param timestamp The earlier timestamp to compare against the current time.
 * @returns A compact relative duration such as `2d 4h` or `35m`.
 */
export function getElapsedTimeLabel(timestamp: string | Date): string {
  const targetDate =
    timestamp instanceof Date ? timestamp : new Date(timestamp);
  const elapsedMs = Date.now() - targetDate.getTime();

  if (Number.isNaN(targetDate.getTime()) || elapsedMs <= 0) {
    return "0m";
  }

  const totalMinutes = Math.floor(elapsedMs / (1000 * 60));

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);

  if (totalHours < 24) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes === 0
      ? `${totalHours}h`
      : `${totalHours}h ${remainingMinutes}m`;
  }

  const totalDays = Math.floor(totalHours / 24);

  if (totalDays < 7) {
    const remainingHours = totalHours % 24;
    return remainingHours === 0
      ? `${totalDays}d`
      : `${totalDays}d ${remainingHours}h`;
  }

  const totalWeeks = Math.floor(totalDays / 7);
  const remainingDays = totalDays % 7;

  return remainingDays === 0
    ? `${totalWeeks}w`
    : `${totalWeeks}w ${remainingDays}d`;
}
