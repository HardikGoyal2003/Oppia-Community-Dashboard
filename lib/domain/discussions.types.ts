export interface Discussion {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  isArchived: boolean;
  createdAt: string;
  lastCommentCreatedAt?: string;
  archivedBy?: string;
  archivedAt?: string;
}
