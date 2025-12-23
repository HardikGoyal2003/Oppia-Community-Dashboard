import { Issue } from "../dashboard.types";

export function getArchiveIssues(): Issue[] {
  const stored = localStorage.getItem("archiveIssues");

  if (!stored) {
    return [];
  }

  return JSON.parse(stored) as Issue[];
};

export function setArchiveIssues(issue: Issue): void {
  let issues = getArchiveIssues();
  issue.isArchived = true;
  issues.push(issue);
  localStorage.setItem("archiveIssues", JSON.stringify(issues));
}


