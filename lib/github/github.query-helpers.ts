import { parseTimestampMs } from "@/lib/utils/date.utils";
import { GitHubGraphQLError, requestGitHubGraphQL } from "./github.request";
import type {
  GitHubDiscussionNode,
  GitHubGoodFirstIssueNode,
  GitHubIssueNode,
  GitHubRepoTarget,
  GitHubUser,
} from "./github.types";
import {
  expectRecord,
  parseArray,
  parseGitHubDiscussionNode,
  parseGitHubGoodFirstIssueNode,
  parseGitHubIssueNode,
  parseOrgAndRepoAccess,
  parsePageInfo,
  type GitHubPermission,
  type JsonValue,
  type PageInfoPayload,
} from "./github.validation";

type GitHubIssuesPage = {
  nodes: GitHubIssueNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type GitHubDiscussionsPage = {
  nodes: GitHubDiscussionNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type GitHubSearchPage = {
  nodes: GitHubGoodFirstIssueNode[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

type IssuesResponse = {
  repository: {
    issues: GitHubIssuesPage;
  };
};

type DiscussionsResponse = {
  repository: {
    discussions: GitHubDiscussionsPage;
  };
};

type GoodFirstIssuesSearchResponse = {
  search: GitHubSearchPage;
};

type CollaboratorEdge = {
  permission: GitHubPermission;
  node: GitHubUser;
};

type OrgAndRepoAccessResult = {
  organization: {
    membersWithRole: {
      nodes: GitHubUser[];
    };
  };
  repository: {
    collaborators: {
      edges: CollaboratorEdge[];
    };
  };
};

/**
 * Validates the GitHub issues response, including every issue node and the
 * pagination metadata.
 *
 * @param value The parsed issues response payload.
 * @param context A description of where the value came from.
 * @returns The validated issues response.
 */
function parseIssuesResponse(
  value: JsonValue,
  context: string,
): IssuesResponse {
  const record = expectRecord(value, context);
  const repository = expectRecord(record.repository, `${context}.repository`);
  const issues = expectRecord(
    repository.issues,
    `${context}.repository.issues`,
  );

  return {
    repository: {
      issues: {
        nodes: parseArray(
          issues.nodes,
          `${context}.repository.issues.nodes`,
          parseGitHubIssueNode,
        ),
        pageInfo: parsePageInfo(
          issues.pageInfo,
          `${context}.repository.issues.pageInfo`,
        ),
      },
    },
  };
}

/**
 * Validates the GitHub discussions response, including every discussion node
 * and the pagination metadata.
 *
 * @param value The parsed discussions response payload.
 * @param context A description of where the value came from.
 * @returns The validated discussions response.
 */
function parseDiscussionsResponse(
  value: JsonValue,
  context: string,
): DiscussionsResponse {
  const record = expectRecord(value, context);
  const repository = expectRecord(record.repository, `${context}.repository`);
  const discussions = expectRecord(
    repository.discussions,
    `${context}.repository.discussions`,
  );

  return {
    repository: {
      discussions: {
        nodes: parseArray(
          discussions.nodes,
          `${context}.repository.discussions.nodes`,
          parseGitHubDiscussionNode,
        ),
        pageInfo: parsePageInfo(
          discussions.pageInfo,
          `${context}.repository.discussions.pageInfo`,
        ),
      },
    },
  };
}

/**
 * Validates the good-first-issues search response, including every node and
 * the pagination metadata.
 *
 * @param value The parsed good-first-issues response payload.
 * @param context A description of where the value came from.
 * @returns The validated good-first-issues response.
 */
function parseGoodFirstIssuesResponse(
  value: JsonValue,
  context: string,
): GoodFirstIssuesSearchResponse {
  const record = expectRecord(value, context);
  const search = expectRecord(record.search, `${context}.search`);

  return {
    search: {
      nodes: parseArray(
        search.nodes,
        `${context}.search.nodes`,
        parseGitHubGoodFirstIssueNode,
      ),
      pageInfo: parsePageInfo(search.pageInfo, `${context}.search.pageInfo`),
    },
  };
}

/**
 * Validates the organization/collaborator response, including member logins
 * and collaborator permission values.
 *
 * @param value The parsed organization/collaborator response payload.
 * @param context A description of where the value came from.
 * @returns The validated access response.
 */
function parseOrgAndRepoAccessResponse(
  value: JsonValue,
  context: string,
): OrgAndRepoAccessResult {
  return parseOrgAndRepoAccess(value, context);
}

/**
 * Ensures a paginated GraphQL response actually advances its cursor.
 *
 * GitHub can report `hasNextPage: true` with a null or repeated cursor. Both
 * cases would otherwise loop forever, so they are treated as invalid responses.
 *
 * @param pageInfo The validated page info for the response.
 * @param requestedCursor The cursor sent with the request.
 * @param context A description of the query for error details.
 * @returns Nothing. Throws when another page is claimed without new progress.
 */
function assertCursorAdvanced(
  pageInfo: PageInfoPayload,
  requestedCursor: string | null,
  context: string,
): void {
  if (!pageInfo.hasNextPage) {
    return;
  }

  if (!pageInfo.endCursor) {
    throw new GitHubGraphQLError(
      `${context} reported another page without an end cursor.`,
      ["endCursor: null"],
    );
  }

  if (pageInfo.endCursor === requestedCursor) {
    throw new GitHubGraphQLError(
      `${context} returned the same cursor, refusing to loop.`,
      [`endCursor: ${pageInfo.endCursor}`],
    );
  }
}

/**
 * Fetches recent repository issues from the last 15 days using paginated GraphQL requests.
 *
 * @param target The repository to fetch from.
 * @returns The aggregated recent issue nodes.
 */
export async function fetchRecentIssueNodes(
  target: GitHubRepoTarget,
): Promise<GitHubIssueNode[]> {
  const issues: GitHubIssueNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

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
    const data: IssuesResponse = await requestGitHubGraphQL<IssuesResponse>(
      query,
      parseIssuesResponse,
      {
        owner: target.owner,
        repo: target.repo,
        cursor,
        since,
      },
    );

    const pageInfo = data.repository.issues.pageInfo;
    assertCursorAdvanced(pageInfo, cursor, "GitHub issues pagination");

    issues.push(...data.repository.issues.nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return issues;
}

/**
 * Fetches repository discussions updated within the last 30 days using paginated GraphQL requests.
 *
 * @param target The repository to fetch from.
 * @returns The aggregated recent discussion nodes.
 */
export async function fetchRecentDiscussionNodes(
  target: GitHubRepoTarget,
): Promise<GitHubDiscussionNode[]> {
  const discussions: GitHubDiscussionNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const query = `
    query($owner: String!, $repo: String!, $cursor: String) {
      repository(owner: $owner, name: $repo) {
        discussions(
          first: 100
          after: $cursor
          orderBy: { field: UPDATED_AT, direction: DESC }
        ) {
          nodes {
            number
            title
            url
            createdAt
            updatedAt
            closed
            author {
              login
            }
            comments(last: 50) {
              nodes {
                createdAt
                author {
                  login
                }
                replies(last: 10) {
                  nodes {
                    createdAt
                    author {
                      login
                    }
                  }
                }
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
    const data: DiscussionsResponse =
      await requestGitHubGraphQL<DiscussionsResponse>(
        query,
        parseDiscussionsResponse,
        {
          owner: target.owner,
          repo: target.repo,
          cursor,
        },
      );

    const nodes = data.repository.discussions.nodes;
    const pageInfo = data.repository.discussions.pageInfo;
    discussions.push(...nodes);

    // Discussions are ordered by UPDATED_AT descending, so once the oldest
    // discussion on a page falls outside the window, every later page will too.
    const oldestUpdatedAt = nodes.at(-1)?.updatedAt;
    const oldestUpdatedAtMs = parseTimestampMs(oldestUpdatedAt);

    if (oldestUpdatedAtMs !== null && oldestUpdatedAtMs < cutoffTime) {
      break;
    }

    assertCursorAdvanced(pageInfo, cursor, "GitHub discussions pagination");
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return discussions;
}

/**
 * Fetches all open, unassigned good-first-issue nodes for a repository.
 *
 * @param target The repository to inspect.
 * @returns The raw matching GFI issue nodes.
 */
export async function fetchGoodFirstIssueNodes(
  target: GitHubRepoTarget,
): Promise<GitHubGoodFirstIssueNode[]> {
  const query = `
    query($searchQuery: String!, $cursor: String) {
      search(query: $searchQuery, type: ISSUE, first: 100, after: $cursor) {
        nodes {
          ... on Issue {
            number
            title
            url
            labels(first: 20) {
              nodes {
                name
              }
            }
            projectsV2(first: 5) {
              nodes {
                title
              }
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  const searchQuery = `repo:${target.owner}/${target.repo} is:issue is:open no:assignee label:"good first issue"`;
  const issues: GitHubGoodFirstIssueNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const data: GoodFirstIssuesSearchResponse =
      await requestGitHubGraphQL<GoodFirstIssuesSearchResponse>(
        query,
        parseGoodFirstIssuesResponse,
        {
          cursor,
          searchQuery,
        },
      );

    const pageInfo = data.search.pageInfo;
    assertCursorAdvanced(
      pageInfo,
      cursor,
      "GitHub good-first-issue pagination",
    );

    issues.push(...data.search.nodes);
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return issues;
}

/**
 * Fetches organization members and repository collaborators for maintainer filtering.
 *
 * @param target The repository to inspect.
 * @returns The organization membership and repository collaborator data.
 */
export async function fetchOrgAndCollaboratorAccess(
  target: GitHubRepoTarget,
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

  const response = await requestGitHubGraphQL<OrgAndRepoAccessResult>(
    query,
    parseOrgAndRepoAccessResponse,
    {
      owner: target.owner,
      repo: target.repo,
    },
  );
  return response;
}
