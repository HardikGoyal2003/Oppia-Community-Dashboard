import { LibInvalidStateError } from "@/lib/lib.errors";

const API_URL = "https://api.github.com";
const API_VERSION = "2026-03-10";

/**
 * Represents a GitHub REST failure with actionable upstream details.
 */
export class GitHubRestError extends LibInvalidStateError {
  details: string[];
  status: number;

  constructor(message: string, status: number, details: string[] = []) {
    super("GitHubREST", message);
    this.name = "GitHubRestError";
    this.details = details;
    this.status = status;
  }
}

/**
 * Executes a GitHub REST request and returns the parsed JSON body.
 *
 * @param path The GitHub REST path beginning with a slash.
 * @param options Optional fetch options (method, body, etc.)
 * @returns The parsed JSON response body.
 * @throws {GitHubRestError} When GitHub returns a non-success response.
 */
export async function requestGitHubRest<T>(
  path: string,
  options?: { method?: string; body?: string },
): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const method = options?.method || "GET";
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": API_VERSION,
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(options?.body ? { body: options.body } : {}),
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    let message = `GitHub REST request failed with status ${res.status}.`;
    const details: string[] = [];

    try {
      const body = (await res.json()) as {
        documentation_url?: string;
        message?: string;
      };

      if (body.message) {
        message = body.message;
      }

      if (body.documentation_url) {
        details.push(body.documentation_url);
      }
    } catch {
      // Ignore JSON parsing errors and fall back to status-based messaging.
    }

    throw new GitHubRestError(message, res.status, details);
  }

  // 204 No Content (e.g. DELETE) has no body
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}
