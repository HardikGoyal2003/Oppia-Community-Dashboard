import { requireEnv } from "@/lib/config/env";
import { RawIssueNode, User } from "./github.types";

const TOKEN = requireEnv("GITHUB_TOKEN");

const API_URL = "https://api.github.com/graphql";

export type GitHubRepoTarget = {
  owner: string;
  repo: string;
};

interface IssuesResponse {
  repository: {
    issues: {
      nodes: RawIssueNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

interface RateLimit {
  rateLimit: RateLimitNode;
}

interface RateLimitNode {
  limit: number;
  cost: number;
  remaining: number;
  resetAt: string;
}

interface OrgAndRepoAccessResult {
  organization: Organization;
  repository: Repository;
}

interface Organization {
  membersWithRole: MembersWithRole;
}

interface MembersWithRole {
  nodes: User[];
}

interface Repository {
  collaborators: Collaborators;
}

interface Collaborators {
  edges: CollaboratorEdge[];
}

interface CollaboratorEdge {
  permission: Permission;
  node: User;
}

type Permission = "READ" | "TRIAGE" | "WRITE" | "MAINTAIN" | "ADMIN";

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
async function request<T>(query: string, variables = {}): Promise<T> {
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

/**
 * Fetches the current GitHub GraphQL rate-limit snapshot.
 *
 * @returns The current GraphQL rate-limit information.
 */
async function fetchRateLimit(): Promise<RateLimit> {
  const query = `
    query {
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `;
  return request(query);
}

/**
 * Fetches recent repository issues from the last 30 days using paginated GraphQL requests.
 *
 * @param owner The repository owner.
 * @param repo The repository name.
 * @returns The aggregated recent issue nodes.
 */
async function fetchRecentIssues(
  owner: string,
  repo: string,
): Promise<RawIssueNode[]> {
  const issues: RawIssueNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  const SINCE = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const query = `
    query($owner: String!, $repo: String!, $cursor: String, $since: DateTime!) {
      repository(owner: $owner, name: $repo) {
        issues(
          first: 100
          after: $cursor
          filterBy: { since: $since }
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            number
            title
            url
            state
            comments(first: 1, orderBy: { field: UPDATED_AT, direction: DESC }) {
              nodes {
                author { login }
                createdAt
              }
            }
            projectsV2(first: 1) {
              nodes {
                title
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const data: IssuesResponse = await request<IssuesResponse>(query, {
      owner,
      repo,
      cursor,
      since: SINCE,
    });

    const page = data.repository.issues;
    issues.push(...page.nodes);

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return issues;
}

/**
 * Fetches organization members and repository collaborators for maintainer filtering.
 *
 * @param owner The organization or repository owner.
 * @param repo The repository name.
 * @returns The organization membership and repository collaborator data.
 */
async function fetchOrgAndCollaborators(
  owner: string,
  repo: string,
): Promise<OrgAndRepoAccessResult> {
  const query = `
    query($owner: String!, $repo: String!) {
      organization(login: $owner) {
        membersWithRole(first: 100) {
          nodes { login }
        }
      }
      repository(owner: $owner, name: $repo) {
        collaborators(first: 100) {
          edges {
            permission
            node { login }
          }
        }
      }
    }
  `;

  return request(query, { owner, repo });
}

/**
 * Fetches unanswered issues whose latest recent comment came from a non-maintainer.
 *
 * @param target The GitHub repository to inspect.
 * @returns The filtered unanswered issue nodes for the dashboard.
 */
export async function fetchUnansweredIssues(target: GitHubRepoTarget) {
  const owner = target.owner;
  const repo = target.repo;

  console.log("Fetching collaborators and org members...");

  const orgData = await fetchOrgAndCollaborators(owner, repo);

  const orgMembers = new Set(
    orgData.organization?.membersWithRole?.nodes.map((m) => m.login) || [],
  );
  const collaborators = orgData.repository.collaborators.edges;

  const collabAll = new Set(collaborators.map((e) => e.node.login));
  const maintainers = new Set(
    collaborators
      .filter((e) => ["ADMIN", "MAINTAIN", "WRITE"].includes(e.permission))
      .map((e) => e.node.login),
  );
  console.log(`Org members: ${orgMembers.size}`);
  console.log(`Collaborators: ${collabAll.size}`);
  console.log(`Maintainers: ${maintainers.size}`);

  console.log("Fetching recent issues (30-day window)...");
  const issues = await fetchRecentIssues(owner, repo);
  console.log(`Fetched ${issues.length} recent issues.`);

  const cutoffTime = Date.now() - 30 * 86400 * 1000;

  const filtered = issues.filter((issue) => {
    if (issue.state === "CLOSED") return false;

    const lastComment = issue.comments.nodes[0];
    if (!lastComment) return false;

    const ts = new Date(lastComment.createdAt).getTime();
    if (ts < cutoffTime) return false;

    const commenter = lastComment.author?.login;

    if (!commenter) return true;

    const isAllowed =
      orgMembers.has(commenter) ||
      collabAll.has(commenter) ||
      maintainers.has(commenter) ||
      commenter === "oppia-github-app";

    return !isAllowed;
  });

  console.log(
    "\nIssues where last comment in past 30 days is from non-maintainer",
  );
  console.log("----------------------------------------------------------");
  console.log(`\nTotal filtered issues: ${filtered.length}`);

  const rate = await fetchRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return filtered;
}
