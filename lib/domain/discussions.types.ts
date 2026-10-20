export interface Discussion {
  discussionNumber: number;
  discussionUrl: string;
  discussionTitle: string;
  isArchived: boolean;
  createdAt: string;
  archivedBy?: string;
  archivedAt?: string;
}
