import { RawIssueNode, User } from "./github.types";

const TOKEN = process.env.GITHUB_TOKEN!;

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

async function request<T>(query: string, variables = {}): Promise<T> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error(json.errors);
    throw new Error("GraphQL error");
  }
  return json.data as T;
}

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
