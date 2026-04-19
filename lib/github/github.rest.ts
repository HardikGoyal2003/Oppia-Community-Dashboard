import { LibInvalidStateError } from "@/lib/lib.errors";

const API_URL = "https://api.github.com";
const API_VERSION = "2022-11-28";

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
 * @returns The parsed JSON response body.
 * @throws {GitHubRestError} When GitHub returns a non-success response.
 */
export async function requestGitHubRest<T>(path: string): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-GitHub-Api-Version": API_VERSION,
    },
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

  return (await res.json()) as T;
}
