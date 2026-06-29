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
 * Parses the Link header from a GitHub REST response to extract the next page URL.
 *
 * @param linkHeader The raw Link header value.
 * @returns The next page URL, or null when there are no more pages.
 */
function getNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  for (const part of linkHeader.split(",")) {
    const [urlPart, relPart] = part.split(";");
    if (relPart?.includes('rel="next"')) {
      const match = urlPart?.trim().match(/^<(.+)>$/);
      if (match) return match[1];
    }
  }

  return null;
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

/**
 * Executes a GitHub REST request and follows pagination to fetch all pages.
 * Uses per_page=100 to minimize the number of requests.
 *
 * @param path The GitHub REST path beginning with a slash.
 * @returns The aggregated array from all pages.
 * @throws {GitHubRestError} When GitHub returns a non-success response.
 */
export async function requestGitHubRestAll<T>(
  path: string,
): Promise<T[]> {
  const allItems: T[] = [];
  const separator = path.includes("?") ? "&" : "?";
  let nextUrl: string | null = `${API_URL}${path}${separator}per_page=100`;

  while (nextUrl) {
    const token = process.env.GITHUB_TOKEN;
    const res = await fetch(nextUrl, {
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
        // Ignore JSON parsing errors.
      }

      throw new GitHubRestError(message, res.status, details);
    }

    const items = (await res.json()) as T[];
    allItems.push(...items);
    nextUrl = getNextPageUrl(res.headers.get("Link"));
  }

  return allItems;
}
