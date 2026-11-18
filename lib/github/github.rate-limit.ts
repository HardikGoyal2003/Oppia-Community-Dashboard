import { requestGitHubRest, getCoreRateLimit } from "./github.rest";
import type { RateLimitSnapshot } from "./github.rest";
import {
  parseRateLimitResponse,
  type GitHubRateLimitPayload,
} from "./github.validation";

type GraphQLRateLimit = GitHubRateLimitPayload;

/** A rate limit report, with nulls marking data that could not be observed. */
export type GitHubRateLimitReport = {
  /** Latest core (REST) snapshot, from headers or the `/rate_limit` body. */
  core: RateLimitSnapshot | null;
  /** GraphQL bucket from the `/rate_limit` body, or null when unavailable. */
  graphql: GraphQLRateLimit | null;
  /** Failure message when the `/rate_limit` request failed, otherwise null. */
  error: string | null;
};

/**
 * Fetches the current GitHub rate limits from the REST endpoint and
 * combines them with the header-captured core rate limit.
 *
 * The `/rate_limit` body is authoritative for both buckets. When the request
 * fails, the last header-captured core snapshot is returned (possibly null) and
 * the failure is reported in `error` rather than masked with healthy defaults.
 *
 * @returns The current core and GraphQL rate limit snapshots plus any failure.
 */
export async function fetchGitHubRateLimit(): Promise<GitHubRateLimitReport> {
  try {
    const data = await requestGitHubRest<{
      resources: {
        core: GraphQLRateLimit | null;
        graphql: GraphQLRateLimit | null;
      };
    }>("/rate_limit", parseRateLimitResponse);

    return {
      core: data.resources.core ?? getCoreRateLimit(),
      graphql: data.resources.graphql,
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown error while fetching GitHub rate limits.";

    console.warn(`[github] Failed to fetch rate limits: ${message}`);

    return {
      core: getCoreRateLimit(),
      graphql: null,
      error: message,
    };
  }
}
