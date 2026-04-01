export interface GitHubUser {
  login: string;
}

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
