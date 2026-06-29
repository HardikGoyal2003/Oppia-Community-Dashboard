import { requestGitHubRest } from "./github.rest";

type CoreRateLimit = {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
};

type RateLimitResources = {
  core: CoreRateLimit;
};

export async function fetchGitHubRateLimit(): Promise<CoreRateLimit> {
  const data = await requestGitHubRest<{ resources: RateLimitResources }>(
    "/rate_limit",
  );

  console.log("Token set:", !!process.env.GITHUB_TOKEN);

  return data.resources.core;
}
