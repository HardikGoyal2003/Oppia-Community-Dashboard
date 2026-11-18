const CRON_REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Computes the remaining cache TTL from a last-updated timestamp.
 *
 * @param lastUpdatedIso The ISO timestamp of the last update, or null.
 * @returns The remaining TTL in milliseconds, floored at zero.
 */
export function computeTtlFromLastUpdated(
  lastUpdatedIso: string | null,
): number {
  if (!lastUpdatedIso) {
    return CRON_REFRESH_INTERVAL_MS;
  }

  const lastUpdated = new Date(lastUpdatedIso).getTime();

  if (Number.isNaN(lastUpdated)) {
    return CRON_REFRESH_INTERVAL_MS;
  }

  const expiresAt = lastUpdated + CRON_REFRESH_INTERVAL_MS;
  const remaining = expiresAt - Date.now();

  return remaining > 0 ? remaining : 0;
}

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

/** A JSON value as returned by `JSON.parse`. */
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Validates a parsed localStorage value as a cache entry.
 *
 * @param value The parsed JSON value.
 * @returns True when the value has a data field and a finite expiry.
 */
function isCacheEntry(value: JsonValue): value is {
  data: JsonValue;
  expiresAt: number;
} {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  return (
    "data" in value &&
    typeof value.expiresAt === "number" &&
    Number.isFinite(value.expiresAt)
  );
}

/**
 * Checks whether a cache TTL is usable.
 *
 * @param ttlMs The time-to-live in milliseconds.
 * @returns True when the TTL is a finite, positive number.
 */
function isValidTtl(ttlMs: number): boolean {
  return Number.isFinite(ttlMs) && ttlMs > 0;
}

/**
 * Reads a cached entry from localStorage, evicting it when expired.
 *
 * @param key The localStorage key to read.
 * @returns The cached data, or null when missing, expired, or malformed.
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as JsonValue;

    if (!isCacheEntry(entry)) {
      console.warn(`[cache] Discarding malformed cache entry for "${key}".`);
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data as T;
  } catch (error) {
    console.warn(`[cache] Failed to read "${key}" from localStorage:`, error);
    return null;
  }
}

/**
 * Writes a cache entry to localStorage with an expiry timestamp.
 *
 * @param key The localStorage key to write.
 * @param data The data to cache.
 * @param ttlMs The time-to-live in milliseconds. Must be finite and positive.
 * @returns Nothing.
 */
export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
  if (!isValidTtl(ttlMs)) {
    console.warn(`[cache] Refusing to write "${key}" with invalid TTL:`, ttlMs);
    return;
  }

  try {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };

    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`[cache] Failed to write "${key}" to localStorage:`, error);
  }
}
