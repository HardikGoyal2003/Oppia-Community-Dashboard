import { requestGitHubRestAll } from "./github.rest";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import fs from "fs";
import path from "path";

const ORG = "oppia";
const REPO = "oppia";

type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string } | null;
  assignees: Array<{ login: string }>;
  requested_teams: Array<{ slug: string }>;
};

type TimelineEvent = {
  event: string;
  assignee?: { login: string } | null;
  requested_team?: { slug: string } | null;
  created_at: string;
};

export type OpenPRAssignment = {
  prNumber: number;
  title: string;
  url: string;
  assignedAt: string;
};

export type MemberPRMap = Map<string, OpenPRAssignment[]>;
export type TeamPRMap = Map<string, OpenPRAssignment[]>;

/**
 * Extracts the most recent `assigned` timeline event timestamp per assignee.
 *
 * @param timelineEvents The timeline events for a single PR.
 * @param currentAssigneeLogins The set of assignee logins to filter for.
 * @returns A map of login to most recent assigned event timestamp.
 */
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

/**
 * Fetches all open PRs from oppia/oppia and maps each assignee to their
 * assigned PRs with timestamps from the PR timeline.
 *
 * @returns A map of GitHub username to their assigned PRs.
 */
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

    if (pr.number === 26078) {
      const logFile = path.join(process.cwd(), "logs", "debug.log");

      fs.mkdirSync(path.dirname(logFile), { recursive: true });

      fs.appendFileSync(
        logFile,
        `[${new Date().toISOString()}] PR ${pr.number}\n${JSON.stringify(timelineEvents, null, 2)}\n\n`,
      );
    }

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
  console.log("\nRate Limit (REST):");
  console.log(rate.core);

  return map;
}

/**
 * Extracts the most recent `review_requested` timeline event timestamp
 * per team slug.
 *
 * @param timelineEvents The timeline events for a single PR.
 * @param currentTeamSlugs The set of team slugs to filter for.
 * @returns A map of team slug to the most recent review_requested timestamp.
 */
function getMostRecentTeamRequests(
  timelineEvents: TimelineEvent[],
  currentTeamSlugs: Set<string>,
): Map<string, string> {
  const reviewRequestedEvents = timelineEvents.filter(
    (e): e is TimelineEvent & { event: "review_requested" } =>
      e.event === "review_requested",
  );
  const result = new Map<string, string>();

  for (const event of reviewRequestedEvents) {
    const slug = event.requested_team?.slug;
    if (!slug) continue;
    if (!currentTeamSlugs.has(slug)) continue;
    result.set(slug, event.created_at);
  }

  return result;
}

/**
 * Fetches all open PRs from oppia/oppia and maps each tracked team slug to
 * PRs requested for review to that team, using timeline `review_requested`
 * events.
 *
 * @param trackedTeamSlugs The list of team slugs to include.
 * @returns A map of team slug to PRs assigned for review to that team.
 */
export async function fetchTeamAssignedPRs(
  trackedTeamSlugs: string[],
): Promise<TeamPRMap> {
  console.log("Fetching open PRs from oppia/oppia (team-level)...");

  const prs = await requestGitHubRestAll<GitHubPullResponse>(
    `/repos/${ORG}/${REPO}/pulls?state=open`,
  );

  console.log(`Found ${prs.length} open PRs.`);

  const trackedSlugsSet = new Set(trackedTeamSlugs);
  const map: TeamPRMap = new Map();

  for (const pr of prs) {
    const requestedTeams = pr.requested_teams;
    if (!requestedTeams || requestedTeams.length === 0) continue;

    const matchingSlugs = requestedTeams
      .map((t) => t.slug)
      .filter((slug) => trackedSlugsSet.has(slug));

    if (matchingSlugs.length === 0) continue;

    console.log(`  Fetching timeline for PR #${pr.number}...`);

    const timelineEvents = await requestGitHubRestAll<TimelineEvent>(
      `/repos/${ORG}/${REPO}/issues/${pr.number}/timeline`,
    );

    const requestTimestamps = getMostRecentTeamRequests(
      timelineEvents,
      new Set(matchingSlugs),
    );

    for (const slug of matchingSlugs) {
      const assignedAt = requestTimestamps.get(slug) ?? pr.created_at;

      const assignment: OpenPRAssignment = {
        prNumber: pr.number,
        title: pr.title,
        url: pr.html_url,
        assignedAt,
      };

      const existing = map.get(slug) ?? [];
      existing.push(assignment);
      map.set(slug, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit (REST):");
  console.log(rate.core);

  return map;
}
