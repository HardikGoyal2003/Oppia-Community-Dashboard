import { RawIssue, RawIssueNode } from "../github-fetcher.types";

export function formatIssues(rawData: RawIssueNode[]): RawIssue[] {
  return rawData.map(issue => ({
    issueNumber: issue.number,
    issueUrl: issue.url,
    issueTitle: issue.title,
    lastCommentCreatedAt: issue.comments.nodes[0].createdAt,
    linkedProject: issue.projectsV2.nodes[0]?.title || ''
  }));
}
