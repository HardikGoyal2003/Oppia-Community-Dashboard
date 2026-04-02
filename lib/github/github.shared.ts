import type { GitHubRepoTarget } from "./github.fetcher";
import { GitHubGraphQLError } from "./github.request";
import { requestGitHubGraphQL } from "./github.request";
import type {
  GitHubGoodFirstIssueNode,
  GitHubIssueNode,
  GitHubUser,
} from "./github.types";

type Permission = "READ" | "TRIAGE" | "WRITE" | "MAINTAIN" | "ADMIN";

type GitHubIssuesPage = {
  nodes: GitHubIssueNode[];
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

type GoodFirstIssuesSearchResponse = {
  search: GitHubSearchPage;
};

type CollaboratorEdge = {
  permission: Permission;
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
 * Validates that the GitHub issues response contains the nested structures required by the fetcher.
 *
 * @param response The parsed issues response payload.
 * @returns Nothing. Throws when the response shape is incomplete.
 */
function assertIssuesResponse(response: IssuesResponse): void {
  if (!response.repository) {
    throw new GitHubGraphQLError(
      "GitHub issues response is missing repository data.",
      [],
    );
  }

  if (!response.repository.issues) {
    throw new GitHubGraphQLError(
      "GitHub issues response is missing issues data.",
      [],
    );
  }

  if (!Array.isArray(response.repository.issues.nodes)) {
    throw new GitHubGraphQLError(
      "GitHub issues response contains invalid issue nodes.",
      [],
    );
  }

  if (!response.repository.issues.pageInfo) {
    throw new GitHubGraphQLError(
      "GitHub issues response is missing pagination data.",
      [],
    );
  }
}

/**
 * Validates that the GitHub good-first-issues search response contains the nested structures required by the fetcher.
 *
 * @param response The parsed good-first-issues response payload.
 * @returns Nothing. Throws when the response shape is incomplete.
 */
function assertGoodFirstIssuesResponse(
  response: GoodFirstIssuesSearchResponse,
): void {
  if (!response.search) {
    throw new GitHubGraphQLError(
      "GitHub GFI response is missing search data.",
      [],
    );
  }

  if (!Array.isArray(response.search.nodes)) {
    throw new GitHubGraphQLError(
      "GitHub GFI response contains invalid issue nodes.",
      [],
    );
  }

  if (!response.search.pageInfo) {
    throw new GitHubGraphQLError(
      "GitHub GFI response is missing pagination data.",
      [],
    );
  }
}

/**
 * Validates that the organization/collaborator response contains the nested structures required by the fetcher.
 *
 * @param response The parsed organization/collaborator response payload.
 * @returns Nothing. Throws when the response shape is incomplete.
 */
function assertOrgAndRepoAccessResponse(
  response: OrgAndRepoAccessResult,
): void {
  if (!response.organization?.membersWithRole?.nodes) {
    throw new GitHubGraphQLError(
      "GitHub organization response is missing member data.",
      [],
    );
  }

  if (!response.repository?.collaborators?.edges) {
    throw new GitHubGraphQLError(
      "GitHub repository response is missing collaborator data.",
      [],
    );
  }
}

/**
 * Fetches recent repository issues from the last 30 days using paginated GraphQL requests.
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
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

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
      {
        owner: target.owner,
        repo: target.repo,
        cursor,
        since,
      },
    );
    assertIssuesResponse(data);

    issues.push(...data.repository.issues.nodes);
    hasNextPage = data.repository.issues.pageInfo.hasNextPage;
    cursor = data.repository.issues.pageInfo.endCursor;
  }

  return issues;
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
      await requestGitHubGraphQL<GoodFirstIssuesSearchResponse>(query, {
        cursor,
        searchQuery,
      });
    assertGoodFirstIssuesResponse(data);

    issues.push(...data.search.nodes);
    hasNextPage = data.search.pageInfo.hasNextPage;
    cursor = data.search.pageInfo.endCursor;
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

  const response = await requestGitHubGraphQL<OrgAndRepoAccessResult>(query, {
    owner: target.owner,
    repo: target.repo,
  });
  assertOrgAndRepoAccessResponse(response);
  return response;
}
