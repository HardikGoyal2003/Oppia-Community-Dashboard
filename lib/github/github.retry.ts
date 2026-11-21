/**
 * Retry policy for transient GitHub API failures.
 *
 * GitHub occasionally returns 5xx responses during long backfills. A single
 * failure currently aborts the whole data job, so both HTTP clients retry a
 * small number of times with capped exponential backoff.
 */

/** Total attempts for one request: the initial call plus two retries. */
const MAX_ATTEMPTS = 3;

/** Base delay before the first retry. */
const BASE_DELAY_MS = 250;

/** Upper bound for any single retry delay, including `Retry-After`. */
const MAX_DELAY_MS = 2_000;

/** Random jitter added to backoff delays to avoid synchronized retries. */
const JITTER_MS = 100;

/**
 * Whether an HTTP status represents a transient GitHub failure worth retrying.
 *
 * @param status The HTTP status from the failed response.
 * @returns True for request timeouts, rate limits, and server errors.
 */
export function isRetryableGitHubStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/**
 * Whether another GitHub request attempt is allowed.
 *
 * @param attempt The one-based index of the attempt that just failed.
 * @returns True when a retry remains.
 */
export function hasGitHubRetriesLeft(attempt: number): boolean {
  return attempt < MAX_ATTEMPTS;
}

/**
 * Computes the delay before the next retry.
 *
 * `Retry-After` is honored when GitHub supplies a usable value, but capped so
 * a long upstream cooldown cannot exhaust a serverless execution window.
 *
 * @param attempt The one-based index of the attempt that just failed.
 * @param retryAfter The raw `Retry-After` header, when present.
 * @returns The delay in milliseconds.
 */
export function getGitHubRetryDelayMs(
  attempt: number,
  retryAfter?: string | null,
): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(Math.ceil(seconds * 1000), MAX_DELAY_MS);
    }

    const retryAt = Date.parse(retryAfter);
    if (!Number.isNaN(retryAt)) {
      return Math.min(Math.max(retryAt - Date.now(), 0), MAX_DELAY_MS);
    }
  }

  const backoff = Math.min(
    BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0),
    MAX_DELAY_MS,
  );

  return backoff + Math.floor(Math.random() * JITTER_MS);
}

/**
 * Waits before retrying a transient GitHub failure.
 *
 * @param delayMs The delay in milliseconds.
 * @returns A promise that resolves when the delay has elapsed.
 */
export async function waitForGitHubRetry(delayMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
