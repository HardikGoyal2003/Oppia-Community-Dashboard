import { requireEnv } from "@/lib/config/env";

const TOKEN = requireEnv("GITHUB_TOKEN");
const API_URL = "https://api.github.com/graphql";

type GraphQLErrorPayload = {
  message?: string;
  type?: string;
  path?: string[];
};

type GraphQLSuccessResponse<T> = {
  data?: T;
  errors?: GraphQLErrorPayload[];
};

/**
 * Represents a GitHub GraphQL failure with actionable upstream details.
 */
export class GitHubGraphQLError extends Error {
  details: string[];

  constructor(message: string, details: string[]) {
    super(message);
    this.name = "GitHubGraphQLError";
    this.details = details;
  }
}

/**
 * Validates that a GraphQL response contains a usable data payload.
 *
 * @param response The parsed GraphQL response body.
 * @returns Nothing. Throws when the payload is missing or malformed.
 */
function assertGraphQLData<T>(
  response: GraphQLSuccessResponse<T>,
): asserts response is { data: T; errors?: GraphQLErrorPayload[] } {
  if (!("data" in response) || response.data === undefined) {
    throw new GitHubGraphQLError(
      "GitHub GraphQL response did not contain a data payload.",
      [],
    );
  }
}

/**
 * Builds a typed GitHub GraphQL error from the upstream error payload.
 *
 * @param errors The GraphQL errors returned by GitHub.
 * @returns The typed GitHub GraphQL error.
 */
function buildGraphQLError(errors: GraphQLErrorPayload[]): GitHubGraphQLError {
  const details = errors.map((error) => {
    const path = error.path?.join(".") ?? "unknown";
    const type = error.type ? ` [${error.type}]` : "";
    return `${error.message ?? "Unknown GraphQL error"}${type} at ${path}`;
  });

  return new GitHubGraphQLError(
    details[0] ?? "GitHub GraphQL request failed.",
    details,
  );
}

/**
 * Executes a GitHub GraphQL request and returns the validated data payload.
 *
 * @param query The GraphQL query string to execute.
 * @param variables The variables to send with the request.
 * @returns The validated GraphQL data payload.
 * @throws {GitHubGraphQLError} When GitHub returns an HTTP or GraphQL error, or the response is malformed.
 */
export async function requestGitHubGraphQL<T>(
  query: string,
  variables = {},
): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new GitHubGraphQLError(
      `GitHub GraphQL request failed with status ${res.status}.`,
      [res.statusText],
    );
  }

  const response = (await res.json()) as GraphQLSuccessResponse<T>;

  if (response.errors && response.errors.length > 0) {
    throw buildGraphQLError(response.errors);
  }

  assertGraphQLData(response);

  return response.data;
}
