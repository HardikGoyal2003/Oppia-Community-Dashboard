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
  const expiresAt = lastUpdated + CRON_REFRESH_INTERVAL_MS;
  const remaining = expiresAt - Date.now();

  return remaining > 0 ? remaining : 0;
}

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

/**
 * Reads a cached entry from localStorage, evicting it when expired.
 *
 * @param key The localStorage key to read.
 * @returns The cached data, or null when missing or expired.
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const entry: CacheEntry<T> = JSON.parse(raw);

    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return entry.data;
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
 * @param ttlMs The time-to-live in milliseconds.
 * @returns Nothing.
 */
export function setCachedData<T>(key: string, data: T, ttlMs: number): void {
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

/**
 * Removes a cache entry from localStorage.
 *
 * @param key The localStorage key to remove.
 * @returns Nothing.
 */
export function clearCachedData(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[cache] Failed to remove "${key}" from localStorage:`, error);
  }
}
