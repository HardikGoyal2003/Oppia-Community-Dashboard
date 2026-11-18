import { requireEnv } from "@/lib/config/env";
import { LibInvalidStateError } from "@/lib/lib.errors";
import {
  expectArray,
  expectRecord,
  GitHubPayloadError,
  type JsonObject,
  type JsonValue,
  type Validator,
} from "./github.validation";

const API_URL = "https://api.github.com/graphql";

type GraphQLErrorPayload = {
  message?: string;
  type?: string;
  path?: string[];
};

/**
 * Parses the raw GraphQL errors field without trusting its shape.
 *
 * @param value The raw errors value.
 * @returns The parsed GraphQL errors.
 * @throws {GitHubGraphQLError} When the errors field is malformed.
 */
function parseGraphQLErrors(value: JsonValue): GraphQLErrorPayload[] {
  return expectArray(value, "GitHub GraphQL response.errors").map(
    (entry, index) => {
      try {
        const record = expectRecord(
          entry,
          `GitHub GraphQL response.errors[${index}]`,
        );
        const path =
          record.path === undefined
            ? undefined
            : expectArray(
                record.path,
                `GitHub GraphQL response.errors[${index}].path`,
              ).map((segment) => String(segment));

        return {
          message:
            typeof record.message === "string" ? record.message : undefined,
          type: typeof record.type === "string" ? record.type : undefined,
          path,
        };
      } catch (error) {
        if (error instanceof GitHubPayloadError) {
          throw new GitHubGraphQLError(
            "GitHub GraphQL response contained malformed errors.",
            [error.message],
          );
        }

        throw error;
      }
    },
  );
}

/**
 * Resolves the GitHub token at request time so optional imports do not fail eagerly.
 *
 * @returns The configured GitHub token.
 */
function getGitHubToken(): string {
  return requireEnv("GITHUB_TOKEN");
}

/**
 * Represents a GitHub GraphQL failure with actionable upstream details.
 */
export class GitHubGraphQLError extends LibInvalidStateError {
  details: string[];

  constructor(message: string, details: string[]) {
    super("GitHubGraphQL", message);
    this.name = "GitHubGraphQLError";
    this.details = details;
  }
}

/**
 * Validates that a GraphQL response contains a usable data payload.
 *
 * @param value The raw parsed GraphQL response body.
 * @returns The parsed data and errors fields.
 * @throws {GitHubGraphQLError} When the envelope is not an object.
 */
function parseGraphQLEnvelope(value: JsonValue): {
  data?: JsonValue;
  errors?: GraphQLErrorPayload[];
} {
  try {
    const record = expectRecord(value, "GitHub GraphQL response");

    return {
      ...(record.data === undefined ? {} : { data: record.data }),
      ...(record.errors === undefined
        ? {}
        : { errors: parseGraphQLErrors(record.errors) }),
    };
  } catch (error) {
    if (error instanceof GitHubPayloadError) {
      throw new GitHubGraphQLError("GitHub GraphQL response was malformed.", [
        error.message,
      ]);
    }

    throw error;
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
 * @param validate Validator for the expected `data` payload.
 * @param variables The variables to send with the request.
 * @returns The validated GraphQL data payload.
 * @throws {GitHubGraphQLError} When GitHub returns an HTTP or GraphQL error, or the response is malformed.
 */
export async function requestGitHubGraphQL<T>(
  query: string,
  validate: Validator<T>,
  variables: JsonObject = {},
): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getGitHubToken()}`,
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

  const response = parseGraphQLEnvelope((await res.json()) as JsonValue);

  if (response.errors && response.errors.length > 0) {
    throw buildGraphQLError(response.errors);
  }

  if (response.data === undefined) {
    throw new GitHubGraphQLError(
      "GitHub GraphQL response did not contain a data payload.",
      [],
    );
  }

  try {
    return validate(response.data, "GitHub GraphQL response.data");
  } catch (error) {
    if (error instanceof GitHubPayloadError) {
      throw new GitHubGraphQLError(
        "GitHub GraphQL response contained an unexpected payload.",
        [error.message],
      );
    }

    throw error;
  }
}
