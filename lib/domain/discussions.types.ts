export interface Discussion {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  isArchived: boolean;
  lastCommentCreatedAt: string;
  archivedBy?: string;
  archivedAt?: string;
}
