import { requestGitHubGraphQL } from "./github.request";

type RateLimitNode = {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
};

type RateLimitResponse = {
  rateLimit: RateLimitNode;
};

/**
 * Fetches the current GitHub GraphQL rate-limit snapshot.
 *
 * @returns The current GraphQL rate-limit information.
 */
export async function fetchGitHubRateLimit(): Promise<RateLimitResponse> {
  const query = `
    query {
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `;

  return requestGitHubGraphQL(query);
}
