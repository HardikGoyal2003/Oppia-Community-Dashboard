import { requestGitHubRest } from "./github.rest";

export type RateLimitSnapshot = {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
};

type RateLimitResources = {
  core: RateLimitSnapshot;
  graphql: RateLimitSnapshot;
};

export async function fetchGitHubRateLimit(): Promise<{
  core: RateLimitSnapshot;
  graphql: RateLimitSnapshot;
}> {
  const data = await requestGitHubRest<{ resources: RateLimitResources }>(
    "/rate_limit",
  );

  console.log("Token set:", !!process.env.GITHUB_TOKEN);

  return {
    core: data.resources.core,
    graphql: data.resources.graphql,
  };
}
