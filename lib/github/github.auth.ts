import { requireEnv } from "@/lib/config/env";

/**
 * Resolves the GitHub token at request time so optional imports do not fail
 * eagerly.
 *
 * Both the REST and GraphQL clients require authentication: unauthenticated
 * requests silently hit much lower rate limits and miss private-repo data, so a
 * missing token fails here with a clear configuration error instead.
 *
 * @returns The configured GitHub token.
 */
export function getGitHubToken(): string {
  return requireEnv("GITHUB_TOKEN");
}
