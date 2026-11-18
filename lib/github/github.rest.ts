import { LibInvalidStateError } from "@/lib/lib.errors";
import { getGitHubToken } from "./github.auth";
import {
  GitHubPayloadError,
  type JsonObject,
  type JsonValue,
  type Validator,
} from "./github.validation";

const API_URL = "https://api.github.com";
const API_ORIGIN = new URL(API_URL).origin;
const API_VERSION = "2026-03-10";

export type RateLimitSnapshot = {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
};

let lastCoreRateLimit: RateLimitSnapshot | null = null;

/**
 * Parses a numeric GitHub rate limit header, ignoring invalid values.
 *
 * @param value The raw header value.
 * @returns The finite number, or null when the header is absent or invalid.
 */
function parseHeaderNumber(value: string | null): number | null {
  if (value === null) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Captures rate limit headers from a GitHub REST response and stores
 * the latest snapshot for the core rate limit.
 *
 * @param res The GitHub REST response to read rate limit headers from.
 * @returns Nothing.
 */
function captureRateLimit(res: Response): void {
  const limit = parseHeaderNumber(res.headers.get("x-ratelimit-limit"));
  const remaining = parseHeaderNumber(res.headers.get("x-ratelimit-remaining"));
  const used = parseHeaderNumber(res.headers.get("x-ratelimit-used"));
  const reset = parseHeaderNumber(res.headers.get("x-ratelimit-reset"));

  if (limit !== null && remaining !== null && used !== null && reset !== null) {
    lastCoreRateLimit = { limit, remaining, used, reset };
  }
}

/**
 * Returns the most recently observed core rate limit snapshot.
 * This is captured from response headers of actual API calls, so it
 * accurately reflects consumed requests.
 *
 * @returns The latest core rate limit snapshot, or null when no response has
 *   been observed yet.
 */
export function getCoreRateLimit(): RateLimitSnapshot | null {
  return lastCoreRateLimit;
}

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
 * Resolves and validates the next page URL from a Link header.
 *
 * The pagination URL is used with the GitHub token attached, so it must stay on
 * the GitHub API origin. Anything else is treated as a malformed response.
 *
 * @param linkHeader The raw Link header value.
 * @returns The validated next page URL, or null when there are no more pages.
 * @throws {GitHubRestError} When the Link header points outside the GitHub API.
 */
function resolveNextPageUrl(linkHeader: string | null): string | null {
  const nextPageUrl = getNextPageUrl(linkHeader);
  if (!nextPageUrl) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(nextPageUrl);
  } catch {
    throw new GitHubRestError(
      "GitHub REST Link header contained an invalid next page URL.",
      502,
      [nextPageUrl],
    );
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.origin !== API_ORIGIN) {
    throw new GitHubRestError(
      "GitHub REST Link header pointed to an untrusted origin.",
      502,
      [nextPageUrl],
    );
  }

  return nextPageUrl;
}

/**
 * Extracts GitHub's error message and documentation link from a failed
 * response body without trusting its shape.
 *
 * @param body The parsed error body.
 * @returns The optional message and documentation URL.
 */
function parseErrorBody(body: JsonValue): {
  message?: string;
  documentationUrl?: string;
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return {};
  }

  const record: JsonObject = body;
  const message =
    typeof record.message === "string" ? record.message : undefined;
  const documentationUrl =
    typeof record.documentation_url === "string"
      ? record.documentation_url
      : undefined;

  return { message, documentationUrl };
}

/**
 * Builds a GitHubRestError for a non-success response.
 *
 * @param res The failed response.
 * @returns The typed REST error.
 */
async function buildRestError(res: Response): Promise<GitHubRestError> {
  let message = `GitHub REST request failed with status ${res.status}.`;
  const details: string[] = [];

  try {
    const { message: bodyMessage, documentationUrl } = parseErrorBody(
      (await res.json()) as JsonValue,
    );

    if (bodyMessage) {
      message = bodyMessage;
    }

    if (documentationUrl) {
      details.push(documentationUrl);
    }
  } catch {
    // Ignore JSON parsing errors and fall back to status-based messaging.
  }

  return new GitHubRestError(message, res.status, details);
}

/**
 * Runs a payload validator, converting validation failures into REST errors.
 *
 * @param value The raw parsed payload.
 * @param validate The validator for the expected payload shape.
 * @param path The request path, used for error context.
 * @returns The validated payload.
 * @throws {GitHubRestError} When the payload does not match the expected shape.
 */
function validateRestPayload<T>(
  value: JsonValue,
  validate: Validator<T>,
  path: string,
): T {
  try {
    return validate(value, `GET ${path}`);
  } catch (error) {
    if (error instanceof GitHubPayloadError) {
      throw new GitHubRestError(
        `Invalid GitHub REST payload: ${error.message}`,
        502,
        [path],
      );
    }

    throw error;
  }
}

/**
 * Executes a single authenticated GitHub REST request.
 *
 * Centralizes token handling, headers, rate-limit capture, and error parsing so
 * the single-page and paginated helpers cannot drift apart.
 *
 * @param url The fully qualified GitHub REST URL to request.
 * @returns The successful response.
 * @throws {GitHubRestError} When GitHub returns a non-success response.
 * @throws {LibConfigError} When GITHUB_TOKEN is not configured.
 */
async function executeGitHubRestRequest(url: string): Promise<Response> {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${getGitHubToken()}`,
      "X-GitHub-Api-Version": API_VERSION,
    },
  });

  if (!res.ok) {
    // GitHub includes rate limit headers on rejected requests too, and those
    // are the most useful ones after a 403/429.
    captureRateLimit(res);
    throw await buildRestError(res);
  }

  captureRateLimit(res);

  return res;
}

/**
 * Executes a GitHub REST request and returns the validated JSON body.
 *
 * @param path The GitHub REST path beginning with a slash.
 * @param validate Validator for the expected response payload.
 * @returns The validated JSON response body.
 * @throws {GitHubRestError} When GitHub returns a non-success response or an
 *   unexpected payload.
 * @throws {LibConfigError} When GITHUB_TOKEN is not configured.
 */
export async function requestGitHubRest<T>(
  path: string,
  validate: Validator<T>,
): Promise<T> {
  const res = await executeGitHubRestRequest(`${API_URL}${path}`);

  return validateRestPayload((await res.json()) as JsonValue, validate, path);
}

/**
 * Executes a GitHub REST request and follows pagination to fetch all pages.
 * Uses per_page=100 to minimize the number of requests.
 *
 * @param path The GitHub REST path beginning with a slash.
 * @param validate Validator for each item in the response pages.
 * @returns The aggregated array from all pages.
 * @throws {GitHubRestError} When GitHub returns a non-success response, a
 *   malformed pagination link, or an unexpected payload.
 * @throws {LibConfigError} When GITHUB_TOKEN is not configured.
 */
export async function requestGitHubRestAll<T>(
  path: string,
  validate: Validator<T>,
): Promise<T[]> {
  const allItems: T[] = [];
  const separator = path.includes("?") ? "&" : "?";
  const visitedUrls = new Set<string>();
  let nextUrl: string | null = `${API_URL}${path}${separator}per_page=100`;

  while (nextUrl) {
    if (visitedUrls.has(nextUrl)) {
      throw new GitHubRestError(
        "GitHub REST pagination repeated a page URL.",
        502,
        [nextUrl],
      );
    }

    visitedUrls.add(nextUrl);

    const res = await executeGitHubRestRequest(nextUrl);
    const items = (await res.json()) as JsonValue;
    allItems.push(
      ...validateRestPayload(items, parseArrayPayload(validate), path),
    );
    nextUrl = resolveNextPageUrl(res.headers.get("Link"));
  }

  return allItems;
}

/**
 * Adapts an item validator into a page-array validator.
 *
 * @param validate The validator for a single item.
 * @returns A validator for an array of items.
 */
function parseArrayPayload<T>(validate: Validator<T>): Validator<T[]> {
  return (value, context) => {
    if (!Array.isArray(value)) {
      throw new GitHubPayloadError(context, "Expected an array");
    }

    return value.map((item, index) => validate(item, `${context}[${index}]`));
  };
}
