import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";

const ORG = "oppia";
const REPO = "oppia";

type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string } | null;
  assignees: Array<{ login: string }>;
};

type TimelineEvent = {
  event: string;
  assignee?: { login: string } | null;
  created_at: string;
};

export type OpenPRAssignment = {
  prNumber: number;
  title: string;
  url: string;
  assignedAt: string;
};

export type MemberPRMap = Map<string, OpenPRAssignment[]>;

function getMostRecentAssignments(
  timelineEvents: TimelineEvent[],
  currentAssigneeLogins: Set<string>,
): Map<string, string> {
  const assignedEvents = timelineEvents.filter(
    (e): e is TimelineEvent & { event: "assigned" } => e.event === "assigned",
  );
  const result = new Map<string, string>();

  for (const event of assignedEvents) {
    const login = event.assignee?.login;
    if (!login) continue;
    if (!currentAssigneeLogins.has(login)) continue;
    result.set(login, event.created_at);
  }

  return result;
}

export async function fetchAssignedPRs(): Promise<MemberPRMap> {
  console.log("Fetching open PRs from oppia/oppia...");

  const prs = await requestGitHubRestAll<GitHubPullResponse>(
    `/repos/${ORG}/${REPO}/pulls?state=open`,
  );

  console.log(`Found ${prs.length} open PRs.`);

  const map: MemberPRMap = new Map();

  for (const pr of prs) {
    const assignees = pr.assignees;
    if (!assignees || assignees.length === 0) continue;

    const author = pr.user?.login;
    const nonAuthorLogins = new Set(
      assignees.map((a) => a.login).filter((l) => l !== author),
    );
    if (nonAuthorLogins.size === 0) continue;

    console.log(`  Fetching timeline for PR #${pr.number}...`);

    const timelineEvents = await requestGitHubRestAll<TimelineEvent>(
      `/repos/${ORG}/${REPO}/issues/${pr.number}/timeline`,
    );

    const assignmentTimestamps = getMostRecentAssignments(
      timelineEvents,
      nonAuthorLogins,
    );

    for (const login of nonAuthorLogins) {
      const assignedAt = assignmentTimestamps.get(login) ?? pr.created_at;

      const assignment: OpenPRAssignment = {
        prNumber: pr.number,
        title: pr.title,
        url: pr.html_url,
        assignedAt,
      };

      const existing = map.get(login) ?? [];
      existing.push(assignment);
      map.set(login, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit:");
  console.log(rate.rateLimit);

  return map;
}
