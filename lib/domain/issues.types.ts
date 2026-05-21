export interface Issue {
  issueNumber: number;
  issueUrl: string;
  issueTitle: string;
  isArchived: boolean;
  lastCommentCreatedAt: string;
  linkedProject: string;
  archivedBy?: string;
  archivedAt?: string;
}
