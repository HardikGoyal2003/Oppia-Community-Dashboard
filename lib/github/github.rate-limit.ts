import { requestGitHubRest } from "./github.rest";

type CoreRateLimit = {
  limit: number;
  remaining: number;
  reset: number;
};

type RateLimitResources = {
  core: CoreRateLimit;
};

export async function fetchGitHubRateLimit(): Promise<CoreRateLimit> {
  const data = await requestGitHubRest<{ resources: RateLimitResources }>(
    "/rate_limit",
  );

  return data.resources.core;
}
