const CRON_REFRESH_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

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

export function setCachedData<T>(
  key: string,
  data: T,
  ttlMs: number,
): void {
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

export function clearCachedData(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[cache] Failed to remove "${key}" from localStorage:`, error);
  }
}
