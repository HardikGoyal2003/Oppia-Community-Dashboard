import { Issue, RawIssueNode } from "../types";

export function formatIssues(rawData: RawIssueNode[]): Issue[] {
  return rawData.map(issue => ({
    issueNumber: issue.number,
    issueUrl: issue.url,
    issueTitle: issue.title,
    linkedProject: issue.projectsV2.nodes[0]?.title || ''
  }));
}
