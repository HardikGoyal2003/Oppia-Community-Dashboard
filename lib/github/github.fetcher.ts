export { GitHubGraphQLError } from "./github.request";
export { fetchGoodFirstIssues } from "./github-gfis.fetcher";
export { fetchUnansweredIssues } from "./github-unanswered-issues.fetcher";

export type GitHubRepoTarget = {
  owner: string;
  repo: string;
};
