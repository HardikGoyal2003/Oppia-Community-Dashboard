import { LibInvalidStateError } from "@/lib/lib.errors";
import type {
  GitHubDiscussionNode,
  GitHubGoodFirstIssueNode,
  GitHubIssueNode,
  GitHubUser,
} from "./github.types";

/**
 * Error raised when an upstream GitHub payload does not match the shape the
 * dashboard expects. TypeScript casts disappear at runtime, so every external
 * payload is checked before it is used.
 */
export class GitHubPayloadError extends LibInvalidStateError {
  constructor(context: string, message: string) {
    super("GitHubPayload", `${message} (${context})`);
    this.name = "GitHubPayloadError";
  }
}

/** A JSON primitive value. */
export type JsonPrimitive = string | number | boolean | null;

/** A JSON object as parsed from an external response body. */
export type JsonObject = { [key: string]: JsonValue };

/** A JSON value as parsed from an external response body. */
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;

/** A function that validates an untyped payload and returns its typed form. */
export type Validator<T> = (value: JsonValue, context: string) => T;

/**
 * Checks whether a value is a plain object.
 *
 * @param value The value to inspect.
 * @returns True when the value is a non-null, non-array object.
 */
function isRecord(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates that a value is a plain object.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The value as a record.
 */
export function expectRecord(value: JsonValue, context: string): JsonObject {
  if (!isRecord(value)) {
    throw new GitHubPayloadError(context, "Expected an object");
  }

  return value;
}

/**
 * Validates that a value is an array.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The value as an array.
 */
export function expectArray(value: JsonValue, context: string): JsonValue[] {
  if (!Array.isArray(value)) {
    throw new GitHubPayloadError(context, "Expected an array");
  }

  return value;
}

/**
 * Validates and maps every element of an array.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @param parseItem Item-level validator.
 * @returns The parsed array.
 */
export function parseArray<T>(
  value: JsonValue,
  context: string,
  parseItem: Validator<T>,
): T[] {
  return expectArray(value, context).map((item, index) =>
    parseItem(item, `${context}[${index}]`),
  );
}

/**
 * Reads a required string field from a record.
 *
 * @param record The record to read from.
 * @param field The field name.
 * @param context A description of where the record came from.
 * @returns The string value.
 */
export function expectString(
  record: JsonObject,
  field: string,
  context: string,
): string {
  const value = record[field];

  if (typeof value !== "string") {
    throw new GitHubPayloadError(context, `Expected "${field}" to be a string`);
  }

  return value;
}

/**
 * Reads a required number field from a record.
 *
 * @param record The record to read from.
 * @param field The field name.
 * @param context A description of where the record came from.
 * @returns The finite number value.
 */
export function expectNumber(
  record: JsonObject,
  field: string,
  context: string,
): number {
  const value = record[field];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new GitHubPayloadError(context, `Expected "${field}" to be a number`);
  }

  return value;
}

/**
 * Reads a required boolean field from a record.
 *
 * @param record The record to read from.
 * @param field The field name.
 * @param context A description of where the record came from.
 * @returns The boolean value.
 */
export function expectBoolean(
  record: JsonObject,
  field: string,
  context: string,
): boolean {
  const value = record[field];

  if (typeof value !== "boolean") {
    throw new GitHubPayloadError(
      context,
      `Expected "${field}" to be a boolean`,
    );
  }

  return value;
}

/**
 * Reads a nullable string field from a record.
 *
 * @param record The record to read from.
 * @param field The field name.
 * @param context A description of where the record came from.
 * @returns The string value, or null when absent or null.
 */
export function expectNullableString(
  record: JsonObject,
  field: string,
  context: string,
): string | null {
  const value = record[field];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new GitHubPayloadError(
      context,
      `Expected "${field}" to be a string or null`,
    );
  }

  return value;
}

/**
 * Validates a GitHub user object down to its login.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The user with a validated login.
 */
export function parseGitHubUser(value: JsonValue, context: string): GitHubUser {
  const record = expectRecord(value, context);
  return { login: expectString(record, "login", context) };
}

/**
 * Validates a nullable GitHub user object.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The user, or null when the value is null/undefined.
 */
export function parseNullableGitHubUser(
  value: JsonValue,
  context: string,
): GitHubUser | null {
  if (value === null || value === undefined) {
    return null;
  }

  return parseGitHubUser(value, context);
}

/** Validated GraphQL page info. */
export type PageInfoPayload = {
  hasNextPage: boolean;
  endCursor: string | null;
};

/**
 * Validates GraphQL pagination metadata.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated page info.
 */
export function parsePageInfo(
  value: JsonValue,
  context: string,
): PageInfoPayload {
  const record = expectRecord(value, context);

  return {
    hasNextPage: expectBoolean(record, "hasNextPage", context),
    endCursor: expectNullableString(record, "endCursor", context),
  };
}

/**
 * Parses a `{ nodes: T[] }` GraphQL connection.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @param parseNode Node-level validator.
 * @returns The validated connection.
 */
function parseNodesConnection<T>(
  value: JsonValue,
  context: string,
  parseNode: Validator<T>,
): { nodes: T[] } {
  const record = expectRecord(value, context);
  return { nodes: parseArray(record.nodes, `${context}.nodes`, parseNode) };
}

type GitHubIssueCommentNode = {
  author: GitHubUser | null;
  createdAt: string;
};

type GitHubIssueProjectNode = {
  title: string;
};

type GitHubLabelNode = {
  name: string;
};

/**
 * Validates a comment node on an issue.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated comment node.
 */
function parseIssueCommentNode(
  value: JsonValue,
  context: string,
): GitHubIssueCommentNode {
  const record = expectRecord(value, context);

  return {
    author: parseNullableGitHubUser(record.author, `${context}.author`),
    createdAt: expectString(record, "createdAt", context),
  };
}

/**
 * Validates a project node attached to an issue.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated project node.
 */
function parseProjectNode(
  value: JsonValue,
  context: string,
): GitHubIssueProjectNode {
  const record = expectRecord(value, context);
  return { title: expectString(record, "title", context) };
}

/**
 * Validates a label node attached to an issue.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated label node.
 */
function parseLabelNode(value: JsonValue, context: string): GitHubLabelNode {
  const record = expectRecord(value, context);
  return { name: expectString(record, "name", context) };
}

/**
 * Validates a raw GitHub issue node from the GraphQL API.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated issue node.
 */
export function parseGitHubIssueNode(
  value: JsonValue,
  context: string,
): GitHubIssueNode {
  const record = expectRecord(value, context);

  return {
    number: expectNumber(record, "number", context),
    title: expectString(record, "title", context),
    url: expectString(record, "url", context),
    state: expectString(record, "state", context),
    comments: parseNodesConnection(
      record.comments,
      `${context}.comments`,
      parseIssueCommentNode,
    ),
    projectsV2: parseNodesConnection(
      record.projectsV2,
      `${context}.projectsV2`,
      parseProjectNode,
    ),
  };
}

/**
 * Validates a raw good-first-issue node from the GraphQL search API.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated good-first-issue node.
 */
export function parseGitHubGoodFirstIssueNode(
  value: JsonValue,
  context: string,
): GitHubGoodFirstIssueNode {
  const record = expectRecord(value, context);

  return {
    number: expectNumber(record, "number", context),
    title: expectString(record, "title", context),
    url: expectString(record, "url", context),
    labels: parseNodesConnection(
      record.labels,
      `${context}.labels`,
      parseLabelNode,
    ),
    projectsV2: parseNodesConnection(
      record.projectsV2,
      `${context}.projectsV2`,
      parseProjectNode,
    ),
  };
}

type GitHubDiscussionCommentNode = {
  createdAt: string;
  author?: GitHubUser;
  replies: { nodes: Array<{ createdAt: string; author?: GitHubUser }> };
};

/**
 * Validates a discussion reply node.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated reply node.
 */
function parseDiscussionReplyNode(
  value: JsonValue,
  context: string,
): { createdAt: string; author?: GitHubUser } {
  const record = expectRecord(value, context);
  const author = parseNullableGitHubUser(record.author, `${context}.author`);

  return {
    createdAt: expectString(record, "createdAt", context),
    ...(author ? { author } : {}),
  };
}

/**
 * Validates a discussion comment node.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated comment node.
 */
function parseDiscussionCommentNode(
  value: JsonValue,
  context: string,
): GitHubDiscussionCommentNode {
  const record = expectRecord(value, context);
  const author = parseNullableGitHubUser(record.author, `${context}.author`);

  return {
    createdAt: expectString(record, "createdAt", context),
    ...(author ? { author } : {}),
    replies: parseNodesConnection(
      record.replies,
      `${context}.replies`,
      parseDiscussionReplyNode,
    ),
  };
}

/**
 * Validates a raw GitHub discussion node from the GraphQL API.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated discussion node.
 */
export function parseGitHubDiscussionNode(
  value: JsonValue,
  context: string,
): GitHubDiscussionNode {
  const record = expectRecord(value, context);
  const author = parseNullableGitHubUser(record.author, `${context}.author`);

  return {
    number: expectNumber(record, "number", context),
    title: expectString(record, "title", context),
    url: expectString(record, "url", context),
    createdAt: expectString(record, "createdAt", context),
    updatedAt: expectString(record, "updatedAt", context),
    closed: expectBoolean(record, "closed", context),
    ...(author ? { author } : {}),
    comments: parseNodesConnection(
      record.comments,
      `${context}.comments`,
      parseDiscussionCommentNode,
    ),
  };
}

/** Permissions GitHub reports for repository collaborators. */
export const GITHUB_PERMISSIONS = [
  "READ",
  "TRIAGE",
  "WRITE",
  "MAINTAIN",
  "ADMIN",
] as const;

export type GitHubPermission = (typeof GITHUB_PERMISSIONS)[number];

/** A validated organization-member or collaborator entry. */
export type GitHubCollaboratorEdge = {
  permission: GitHubPermission;
  node: GitHubUser;
};

/** Validated org membership and collaborator access data. */
export type GitHubOrgAndRepoAccess = {
  organization: { membersWithRole: { nodes: GitHubUser[] } };
  repository: { collaborators: { edges: GitHubCollaboratorEdge[] } };
};

/**
 * Validates a GitHub collaborator permission value.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated permission.
 */
function parsePermission(value: JsonValue, context: string): GitHubPermission {
  if (
    typeof value !== "string" ||
    !GITHUB_PERMISSIONS.includes(value as GitHubPermission)
  ) {
    throw new GitHubPayloadError(
      context,
      `Expected a known collaborator permission, received ${JSON.stringify(value)}`,
    );
  }

  return value as GitHubPermission;
}

/**
 * Validates a collaborator edge, including its permission.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated collaborator edge.
 */
function parseCollaboratorEdge(
  value: JsonValue,
  context: string,
): GitHubCollaboratorEdge {
  const record = expectRecord(value, context);

  return {
    permission: parsePermission(record.permission, `${context}.permission`),
    node: parseGitHubUser(record.node, `${context}.node`),
  };
}

/**
 * Validates the organization membership and collaborator access payload.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated access payload.
 */
export function parseOrgAndRepoAccess(
  value: JsonValue,
  context: string,
): GitHubOrgAndRepoAccess {
  const record = expectRecord(value, context);
  const organization = expectRecord(
    record.organization,
    `${context}.organization`,
  );
  const repository = expectRecord(record.repository, `${context}.repository`);

  return {
    organization: {
      membersWithRole: parseNodesConnection(
        organization.membersWithRole,
        `${context}.organization.membersWithRole`,
        parseGitHubUser,
      ),
    },
    repository: {
      collaborators: {
        edges: parseArray(
          expectRecord(
            repository.collaborators,
            `${context}.repository.collaborators`,
          ).edges,
          `${context}.repository.collaborators.edges`,
          parseCollaboratorEdge,
        ),
      },
    },
  };
}

/** Validated GraphQL rate limit resource bucket. */
export type GitHubRateLimitPayload = {
  limit: number;
  remaining: number;
  used: number;
  reset: number;
};

/**
 * Validates a GraphQL rate limit bucket.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated rate limit bucket.
 */
export function parseRateLimitBucket(
  value: JsonValue,
  context: string,
): GitHubRateLimitPayload {
  const record = expectRecord(value, context);

  return {
    limit: expectNumber(record, "limit", context),
    remaining: expectNumber(record, "remaining", context),
    used: expectNumber(record, "used", context),
    reset: expectNumber(record, "reset", context),
  };
}

/**
 * Validates an optional rate limit bucket.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated bucket, or null when GitHub omitted it.
 */
function parseOptionalRateLimitBucket(
  value: JsonValue,
  context: string,
): GitHubRateLimitPayload | null {
  if (value === null || value === undefined) {
    return null;
  }

  return parseRateLimitBucket(value, context);
}

/**
 * Validates the REST `/rate_limit` response.
 *
 * Both the core and GraphQL buckets are returned as-is so callers can report a
 * missing bucket instead of inventing a healthy default.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated rate limit buckets.
 */
export function parseRateLimitResponse(
  value: JsonValue,
  context: string,
): {
  resources: {
    core: GitHubRateLimitPayload | null;
    graphql: GitHubRateLimitPayload | null;
  };
} {
  const record = expectRecord(value, context);
  const resources = expectRecord(record.resources, `${context}.resources`);

  return {
    resources: {
      core: parseOptionalRateLimitBucket(
        resources.core,
        `${context}.resources.core`,
      ),
      graphql: parseOptionalRateLimitBucket(
        resources.graphql,
        `${context}.resources.graphql`,
      ),
    },
  };
}

/** Validated REST pull request payload. */
export type GitHubPullRequestPayload = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  user: GitHubUser | null;
  assignees: GitHubUser[] | null;
  requested_teams: Array<{ slug: string }>;
  pull_request?: JsonObject;
  additions?: number;
  changed_files?: number;
};

/**
 * Validates a `{ slug: string }` team reference.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated team reference.
 */
function parseTeamRef(value: JsonValue, context: string): { slug: string } {
  const record = expectRecord(value, context);
  return { slug: expectString(record, "slug", context) };
}

/**
 * Validates a REST pull request payload (single PR or search item).
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated pull request.
 */
export function parseGitHubPullRequest(
  value: JsonValue,
  context: string,
): GitHubPullRequestPayload {
  const record = expectRecord(value, context);
  const rawAssignees = record.assignees;
  const rawTeams = record.requested_teams;
  const rawPullRequest = record.pull_request;

  return {
    number: expectNumber(record, "number", context),
    title: expectString(record, "title", context),
    html_url: expectString(record, "html_url", context),
    created_at: expectString(record, "created_at", context),
    closed_at: expectNullableString(record, "closed_at", context),
    user: parseNullableGitHubUser(record.user, `${context}.user`),
    assignees:
      rawAssignees === null || rawAssignees === undefined
        ? null
        : parseArray(rawAssignees, `${context}.assignees`, parseGitHubUser),
    requested_teams:
      rawTeams === null || rawTeams === undefined
        ? []
        : parseArray(rawTeams, `${context}.requested_teams`, parseTeamRef),
    ...(rawPullRequest === undefined
      ? {}
      : {
          pull_request: expectRecord(rawPullRequest, `${context}.pull_request`),
        }),
    ...(record.additions === undefined
      ? {}
      : { additions: expectNumber(record, "additions", context) }),
    ...(record.changed_files === undefined
      ? {}
      : { changed_files: expectNumber(record, "changed_files", context) }),
  };
}

/** Validated REST issue timeline event. */
export type GitHubTimelineEventPayload = {
  event: string;
  assignee?: GitHubUser | null;
  requested_team?: { slug: string } | null;
  /**
   * Absent on event types GitHub does not timestamp, such as `committed`
   * (which carries commit author/committer dates instead) and `reviewed`.
   */
  created_at?: string;
};

/**
 * Validates a REST issue timeline event.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated timeline event.
 */
export function parseGitHubTimelineEvent(
  value: JsonValue,
  context: string,
): GitHubTimelineEventPayload {
  const record = expectRecord(value, context);
  const createdAt = expectNullableString(record, "created_at", context);

  return {
    event: expectString(record, "event", context),
    assignee: parseNullableGitHubUser(record.assignee, `${context}.assignee`),
    requested_team:
      record.requested_team === null || record.requested_team === undefined
        ? null
        : parseTeamRef(record.requested_team, `${context}.requested_team`),
    ...(createdAt === null ? {} : { created_at: createdAt }),
  };
}

/** Validated REST review submission. */
export type GitHubReviewPayload = {
  user: GitHubUser | null;
  state: string;
  body: string | null;
  /** Null for pending drafts, which GitHub has not submitted yet. */
  submitted_at: string | null;
};

/**
 * Validates a REST review submission.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated review.
 */
export function parseGitHubReview(
  value: JsonValue,
  context: string,
): GitHubReviewPayload {
  const record = expectRecord(value, context);

  return {
    user: parseNullableGitHubUser(record.user, `${context}.user`),
    state: expectString(record, "state", context),
    body: expectNullableString(record, "body", context),
    submitted_at: expectNullableString(record, "submitted_at", context),
  };
}

/** Validated REST inline review comment. */
export type GitHubInlineCommentPayload = {
  user: GitHubUser | null;
  body: string;
};

/**
 * Validates a REST inline review comment.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated inline comment.
 */
export function parseGitHubInlineComment(
  value: JsonValue,
  context: string,
): GitHubInlineCommentPayload {
  const record = expectRecord(value, context);

  return {
    user: parseNullableGitHubUser(record.user, `${context}.user`),
    body: expectString(record, "body", context),
  };
}

/**
 * Validates a REST search response envelope.
 *
 * @param parseItem Item-level validator.
 * @returns A validator for the search envelope.
 */
export function parseSearchResponse<T>(
  parseItem: Validator<T>,
): Validator<{ items: T[]; total_count: number }> {
  return (value, context) => {
    const record = expectRecord(value, context);

    return {
      items: parseArray(record.items, `${context}.items`, parseItem),
      total_count: expectNumber(record, "total_count", context),
    };
  };
}

/** Validated REST team payload. */
export type GitHubTeamPayload = {
  slug: string;
  name: string;
  description: string | null;
};

/**
 * Validates a REST team payload.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated team.
 */
export function parseGitHubTeam(
  value: JsonValue,
  context: string,
): GitHubTeamPayload {
  const record = expectRecord(value, context);

  return {
    slug: expectString(record, "slug", context),
    name: expectString(record, "name", context),
    description: expectNullableString(record, "description", context),
  };
}

/** Validated REST team member payload. */
export type GitHubTeamMemberPayload = {
  login: string;
  avatar_url: string;
};

/**
 * Validates a REST team member payload.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated team member.
 */
export function parseGitHubTeamMember(
  value: JsonValue,
  context: string,
): GitHubTeamMemberPayload {
  const record = expectRecord(value, context);

  return {
    login: expectString(record, "login", context),
    avatar_url: expectString(record, "avatar_url", context),
  };
}

/** Validated issue payload used by contributor-journey verification. */
export type GitHubIssueDetailPayload = {
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  body: string | null;
  html_url: string;
  number: number;
  pull_request?: JsonObject;
};

/**
 * Validates the issue payload used by contributor-journey verification.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated issue.
 */
export function parseGitHubIssueDetail(
  value: JsonValue,
  context: string,
): GitHubIssueDetailPayload {
  const record = expectRecord(value, context);

  return {
    assignee: parseNullableGitHubUser(record.assignee, `${context}.assignee`),
    assignees:
      record.assignees === null || record.assignees === undefined
        ? []
        : parseArray(record.assignees, `${context}.assignees`, parseGitHubUser),
    body: expectNullableString(record, "body", context),
    html_url: expectString(record, "html_url", context),
    number: expectNumber(record, "number", context),
    ...(record.pull_request === undefined
      ? {}
      : {
          pull_request: expectRecord(
            record.pull_request,
            `${context}.pull_request`,
          ),
        }),
  };
}

/** Validated pull request payload used by contributor-journey verification. */
export type GitHubPullRequestDetailPayload = {
  html_url: string;
  merged_at: string | null;
  number: number;
  user: GitHubUser | null;
};

/**
 * Validates the pull request payload used by contributor-journey verification.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated pull request.
 */
export function parseGitHubPullRequestDetail(
  value: JsonValue,
  context: string,
): GitHubPullRequestDetailPayload {
  const record = expectRecord(value, context);

  return {
    html_url: expectString(record, "html_url", context),
    merged_at: expectNullableString(record, "merged_at", context),
    number: expectNumber(record, "number", context),
    user: parseNullableGitHubUser(record.user, `${context}.user`),
  };
}

/**
 * Validates the aliased `issueCount` record returned by the authored-PR query.
 *
 * @param value The value to validate.
 * @param context A description of where the value came from.
 * @returns The validated aliases mapped to issue counts.
 */
export function parseIssueCountRecord(
  value: JsonValue,
  context: string,
): Record<string, { issueCount: number }> {
  const record = expectRecord(value, context);
  const result: Record<string, { issueCount: number }> = {};

  for (const [alias, entry] of Object.entries(record)) {
    const entryRecord = expectRecord(entry, `${context}.${alias}`);
    result[alias] = {
      issueCount: expectNumber(
        entryRecord,
        "issueCount",
        `${context}.${alias}`,
      ),
    };
  }

  return result;
}
