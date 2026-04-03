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
