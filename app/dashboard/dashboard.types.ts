export interface Issue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  isArchived: boolean;
  lastCommentCreatedAt: string,
  linkedProject: string;
}

export interface CategorizedProjectIssues {
  leap: Issue[];
  core: Issue[];
  dev: Issue[];
  others: Issue[];
  archive: Issue[];
}