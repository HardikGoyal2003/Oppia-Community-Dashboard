export interface Issue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  isArchived: boolean;
  lastCommentCreatedAt: string;
  linkedProject: string;
}

export interface CategorizedProjectIssues {
  team1: Issue[];
  team2: Issue[];
  team3: Issue[];
  others: Issue[];
  archive: Issue[];
}
