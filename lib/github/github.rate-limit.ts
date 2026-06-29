import { requestGitHubRest, getCoreRateLimit } from "./github.rest";

export type { RateLimitSnapshot } from "./github.rest";
export { getCoreRateLimit } from "./github.rest";

type GraphQLRateLimit = {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
};

/**
 * Fetches the current GitHub rate limits from the REST endpoint and
 * combines them with the header-captured core rate limit.
 *
 * Core (REST) → from response headers (always accurate).
 * GraphQL    → from the endpoint body (accurate for GraphQL).
 */
export async function fetchGitHubRateLimit(): Promise<{
  core: import("./github.rest").RateLimitSnapshot;
  graphql: GraphQLRateLimit;
}> {
  const core = getCoreRateLimit();

  let graphql: GraphQLRateLimit = { limit: 5000, remaining: 5000, used: 0, reset: 0 };

  try {
    const data = await requestGitHubRest<{
      resources: { graphql: GraphQLRateLimit };
    }>("/rate_limit");
    graphql = data.resources.graphql;
  } catch {
    // Fall back to defaults if the rate limit endpoint fails.
  }

  return { core, graphql };
}
