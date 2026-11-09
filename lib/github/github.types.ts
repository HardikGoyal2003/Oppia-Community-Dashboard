export interface GitHubUser {
  login: string;
}

export type GitHubRepoTarget = {
  owner: string;
  repo: string;
};

interface GitHubProject {
  title: string;
}

interface GitHubLabel {
  name: string;
}

interface GitHubCommentConnection {
  nodes: {
    author: GitHubUser;
    createdAt: string;
  }[];
}

interface GitHubProjectConnection {
  nodes: GitHubProject[];
}

interface GitHubLabelConnection {
  nodes: GitHubLabel[];
}

// Raw upstream GraphQL issue shape returned by the GitHub API.
export interface GitHubIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  comments: GitHubCommentConnection;
  projectsV2: GitHubProjectConnection;
}

// Raw upstream GraphQL issue shape returned by the GitHub search API for good first issues.
export interface GitHubGoodFirstIssueNode {
  number: number;
  title: string;
  url: string;
  labels: GitHubLabelConnection;
  projectsV2: GitHubProjectConnection;
}

// Normalized app-facing issue shape used by the dashboard after mapping.
export interface GitHubIssue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  lastCommentCreatedAt: string;
  linkedProject: string;
}

// Normalized app-facing good first issue shape used for team/domain classification.
export interface GitHubGoodFirstIssue {
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  labels: string[];
  linkedProject: string;
}

// `author` is nullable in GitHub's GraphQL schema because a comment can outlive
// its author's account (deleted/suspended users). Consumers use `author?.login`
// and treat an unknown author as a non-maintainer, so the thread stays visible.
interface GitHubDiscussionCommentNode {
  createdAt: string;
  author?: GitHubUser;
  replies: {
    nodes: {
      createdAt: string;
      author?: GitHubUser;
    }[];
  };
}

export interface GitHubDiscussionNode {
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  closed: boolean;
  author?: GitHubUser;
  comments: {
    nodes: GitHubDiscussionCommentNode[];
  };
}

export interface GitHubDiscussion {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  createdAt: string;
  lastCommentCreatedAt: string;
}
