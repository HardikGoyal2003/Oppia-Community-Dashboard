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
  const raw = await requestGitHubRest<Record<string, unknown>>(
    "/rate_limit",
  );

  console.log("Token set:", !!process.env.GITHUB_TOKEN);
  console.log("Raw /rate_limit keys:", Object.keys(raw));
  console.log("Raw resources:", JSON.stringify(raw.resources, null, 2));

  const resources = raw.resources as RateLimitResources;

  return {
    core: resources.core,
    graphql: resources.graphql,
  };
}
