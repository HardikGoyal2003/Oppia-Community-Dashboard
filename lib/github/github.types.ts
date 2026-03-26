export interface GitHubUser {
  login: string;
}

interface GitHubProject {
  title: string;
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

export interface GitHubIssueNode {
  number: number;
  title: string;
  url: string;
  state: string;
  comments: GitHubCommentConnection;
  projectsV2: GitHubProjectConnection;
}

export interface GitHubIssue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  lastCommentCreatedAt: string;
  linkedProject: string;
}
