import { requestGitHubRest, requestGitHubRestAll } from "./github.rest";
import { requestGitHubGraphQL } from "./github.request";
import { fetchGitHubRateLimit } from "./github.rate-limit";
import fs from "fs";
import path from "path";

const ORG = "oppia";
const REPO = "oppia";

export type GitHubPullResponse = {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  closed_at: string | null;
  user: { login: string } | null;
  assignees: Array<{ login: string }> | null;
  requested_teams: Array<{ slug: string }>;
  pull_request?: Record<string, string>;
  /** Present on single-PR REST responses, absent from search results. */
  additions?: number;
  changed_files?: number;
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
export type ReviewerStatsMap = Map<
  string,
  { reviewsDone: number; totalReviewTimeMs: number; pendingReviews: number }
>;

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

export type CycleRecord = {
  reviewerLogin: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  assignedAt: string;
  completedAt: string;
  durationMs: number;
  reviewRoundsBeforeApproval: number | null;
  commentCount: number;
  /** Non-pending review submissions made by the reviewer on this PR. */
  reviewSubmissionCount: number;
  /** Timestamp of the reviewer's first approval on this PR, if any. */
  approvedAt: string | null;
  /** Assignment → first approval duration in ms, if approved. */
  approvalDurationMs: number | null;
  /** Lines added by the PR (size proxy), if known. */
  prAdditions: number | null;
};

export type CycleRecordsResult = {
  completed: CycleRecord[];
  pending: Array<{
    reviewerLogin: string;
    prNumber: number;
    prTitle: string;
    prUrl: string;
    assignedAt: string;
  }>;
  reviewerPRStats: Map<string, Map<number, ReviewerPRStats>>;
  /** Authors of every PR scanned in the window, used for authored-count refresh. */
  authorLogins: Set<string>;
};

type GitHubReviewResponse = {
  user: { login: string };
  state: string;
  body: string | null;
  submitted_at: string;
};

type InlineComment = {
  user: { login: string };
  body: string;
};

export type ReviewerPRStats = {
  reviewRoundsBeforeApproval: number | null;
  commentCount: number;
  /** Non-pending review submissions by this reviewer on the PR. */
  reviewSubmissionCount: number;
  /** Timestamp of this reviewer's first approval on the PR, if any. */
  approvedAt: string | null;
};

type CycleEvent = {
  type: "assigned" | "unassigned" | "reviewed";
  timestamp: string;
};

/**
 * Computes review cycles from timeline and review events per assignee.
 *
 * Each `assigned` event paired with a following `unassigned` or
 * non-PENDING review submission counts as one completed review cycle.
 * Unpaired `assigned` events count as pending reviews.
 *
 * @param timelineEvents The timeline events for a single PR.
 * @param reviews The PR review submissions.
 * @param nonAuthorLogins The set of non-author assignee logins.
 * @returns A map of login to computed review stats.
 */
function computeReviewCycles(
  timelineEvents: TimelineEvent[],
  reviews: GitHubReviewResponse[],
  nonAuthorLogins: Set<string>,
): Map<
  string,
  { reviewsDone: number; totalReviewTimeMs: number; pendingReviews: number }
> {
  const result = new Map<
    string,
    { reviewsDone: number; totalReviewTimeMs: number; pendingReviews: number }
  >();

  for (const login of nonAuthorLogins) {
    const events: CycleEvent[] = [];

    for (const e of timelineEvents) {
      if (e.event === "assigned" && e.assignee?.login === login) {
        events.push({ type: "assigned", timestamp: e.created_at });
      }
      if (e.event === "unassigned" && e.assignee?.login === login) {
        events.push({ type: "unassigned", timestamp: e.created_at });
      }
    }

    for (const r of reviews) {
      if (r.user?.login === login && r.state !== "PENDING") {
        events.push({ type: "reviewed", timestamp: r.submitted_at });
      }
    }

    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let reviewsDone = 0;
    let totalReviewTimeMs = 0;
    let pendingReviews = 0;
    let inCycle = false;
    let cycleStart = "";

    for (const event of events) {
      if (event.type === "assigned") {
        if (inCycle) {
          pendingReviews++;
        }
        inCycle = true;
        cycleStart = event.timestamp;
      } else {
        if (inCycle) {
          reviewsDone++;
          totalReviewTimeMs +=
            new Date(event.timestamp).getTime() -
            new Date(cycleStart).getTime();
          inCycle = false;
        }
      }
    }

    if (inCycle) {
      pendingReviews++;
    }

    result.set(login, {
      reviewsDone,
      totalReviewTimeMs: Math.max(0, totalReviewTimeMs),
      pendingReviews,
    });
  }

  return result;
}

/**
 * Fetches review stats for all open PRs — how many review cycles each
 * assignee has completed and the total/pending review counts.
 *
 * Cycles are computed from the PR timeline by pairing each `assigned`
 * event with the next `unassigned` or review-submission event.
 *
 * @returns A map of username to their review stats.
 */
export async function fetchReviewerStats(): Promise<ReviewerStatsMap> {
  console.log("Fetching review stats...");

  const prs = await requestGitHubRestAll<GitHubPullResponse>(
    `/repos/${ORG}/${REPO}/pulls?state=open`,
  );

  const statsMap: ReviewerStatsMap = new Map();

  for (const pr of prs) {
    const assignees = pr.assignees;
    if (!assignees || assignees.length === 0) continue;

    const author = pr.user?.login;
    const nonAuthorLogins = new Set(
      assignees.map((a) => a.login).filter((l) => l !== author),
    );
    if (nonAuthorLogins.size === 0) continue;

    console.log(`  Fetching timeline & reviews for PR #${pr.number}...`);

    const [timelineEvents, reviews] = await Promise.all([
      requestGitHubRestAll<TimelineEvent>(
        `/repos/${ORG}/${REPO}/issues/${pr.number}/timeline`,
      ),
      requestGitHubRestAll<GitHubReviewResponse>(
        `/repos/${ORG}/${REPO}/pulls/${pr.number}/reviews`,
      ),
    ]);

    const perUser = computeReviewCycles(
      timelineEvents,
      reviews,
      nonAuthorLogins,
    );

    for (const [login, stats] of perUser) {
      const existing = statsMap.get(login) ?? {
        reviewsDone: 0,
        totalReviewTimeMs: 0,
        pendingReviews: 0,
      };
      existing.reviewsDone += stats.reviewsDone;
      existing.totalReviewTimeMs += stats.totalReviewTimeMs;
      existing.pendingReviews += stats.pendingReviews;
      statsMap.set(login, existing);
    }
  }

  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit (REST):");
  console.log(rate.core);

  return statsMap;
}

/**
 * Collects every reviewer login that was assigned to the PR at some point.
 *
 * Current assignees alone are not enough: a reviewer can be unassigned
 * before the PR closes while still having a completed review cycle in the
 * timeline.
 *
 * @param pr The PR response from GitHub.
 * @param timelineEvents The timeline events for the PR.
 * @returns The non-author logins seen in current assignees or the timeline.
 */
function collectCandidateReviewerLogins(
  pr: GitHubPullResponse,
  timelineEvents: TimelineEvent[],
): Set<string> {
  const author = pr.user?.login;
  const logins = new Set<string>();

  for (const assignee of pr.assignees ?? []) {
    if (assignee.login !== author) logins.add(assignee.login);
  }

  for (const event of timelineEvents) {
    if (event.event !== "assigned" && event.event !== "unassigned") continue;

    const login = event.assignee?.login;
    if (login && login !== author) logins.add(login);
  }

  return logins;
}

/**
 * Processes a single PR's timeline and reviews to extract completed and
 * pending review cycles for the supplied reviewer logins.
 *
 * @param pr The PR response from GitHub.
 * @param timelineEvents The timeline events for the PR.
 * @param reviews The review submissions for the PR.
 * @param includePending Whether to include pending (unpaired) cycles.
 * @param reviewerStats PR-level per-reviewer stats (rounds before approval,
 * comment count, submissions). They are copied onto every cycle for the PR
 * and deduplicated by PR during aggregation.
 * @param prAdditions Lines added by the PR, if known.
 * @param reviewerLogins The logins with assignment activity on the PR.
 * @returns Completed cycles and optionally pending cycles.
 */
function extractCyclesFromPR(
  pr: GitHubPullResponse,
  timelineEvents: TimelineEvent[],
  reviews: GitHubReviewResponse[],
  includePending: boolean,
  reviewerStats: Map<string, ReviewerPRStats>,
  prAdditions: number | null,
  reviewerLogins: Set<string>,
): { completed: CycleRecord[]; pending: CycleRecordsResult["pending"] } {
  const completed: CycleRecord[] = [];
  const pending: CycleRecordsResult["pending"] = [];

  for (const login of reviewerLogins) {
    const stats = reviewerStats.get(login);
    const reviewRoundsBeforeApproval =
      stats?.reviewRoundsBeforeApproval ?? null;
    const commentCount = stats?.commentCount ?? 0;
    const reviewSubmissionCount = stats?.reviewSubmissionCount ?? 0;
    const approvedAt = stats?.approvedAt ?? null;
    const approvedAtMs = approvedAt ? new Date(approvedAt).getTime() : null;
    let approvalAttached = false;

    const events: CycleEvent[] = [];

    for (const e of timelineEvents) {
      if (e.event === "assigned" && e.assignee?.login === login) {
        events.push({ type: "assigned", timestamp: e.created_at });
      }
      if (e.event === "unassigned" && e.assignee?.login === login) {
        events.push({ type: "unassigned", timestamp: e.created_at });
      }
    }

    for (const r of reviews) {
      if (r.user?.login === login && r.state !== "PENDING") {
        events.push({ type: "reviewed", timestamp: r.submitted_at });
      }
    }

    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let cycleStart = "";
    let inCycle = false;

    for (const event of events) {
      if (event.type === "assigned") {
        if (inCycle) {
          if (includePending) {
            pending.push({
              reviewerLogin: login,
              prNumber: pr.number,
              prTitle: pr.title,
              prUrl: pr.html_url,
              assignedAt: cycleStart,
            });
          }
        }
        inCycle = true;
        cycleStart = event.timestamp;
      } else {
        if (inCycle) {
          const eventMs = new Date(event.timestamp).getTime();
          const cycleStartMs = new Date(cycleStart).getTime();
          const durationMs = eventMs - cycleStartMs;
          // Approvals are PR-level, but an approval only belongs to a cycle
          // when it happened while that cycle was open. Without the upper
          // bound, an approval submitted after a "changes requested" review
          // would be attributed to the cycle that review already closed.
          const attachApproval =
            !approvalAttached &&
            approvedAtMs !== null &&
            approvedAtMs >= cycleStartMs &&
            approvedAtMs <= eventMs;
          if (attachApproval) {
            approvalAttached = true;
          }
          completed.push({
            reviewerLogin: login,
            prNumber: pr.number,
            prTitle: pr.title,
            prUrl: pr.html_url,
            assignedAt: cycleStart,
            completedAt: event.timestamp,
            durationMs: Math.max(0, durationMs),
            reviewRoundsBeforeApproval,
            commentCount,
            reviewSubmissionCount,
            approvedAt: attachApproval ? approvedAt : null,
            approvalDurationMs:
              attachApproval && approvedAtMs !== null
                ? Math.max(0, approvedAtMs - cycleStartMs)
                : null,
            prAdditions,
          });
          inCycle = false;
        }
      }
    }

    if (inCycle && includePending) {
      pending.push({
        reviewerLogin: login,
        prNumber: pr.number,
        prTitle: pr.title,
        prUrl: pr.html_url,
        assignedAt: cycleStart,
      });
    }
  }

  return { completed, pending };
}

/**
 * Computes PR-level per-reviewer stats for a single PR: review rounds before
 * the reviewer's first approval, total comment count (review bodies + inline
 * comments), and non-pending review submissions.
 *
 * These are deliberately PR-level, not per-cycle. The same values are copied
 * onto each of the reviewer's cycles for the PR, and `aggregateCycleRecords`
 * deduplicates them by PR number so they are counted once.
 *
 * @param reviews The review submissions for the PR.
 * @param inlineComments The inline code comments on the PR.
 * @param reviewerLogins The logins with assignment activity on the PR.
 * @returns A map of reviewer login to their PR-level stats.
 */
function extractReviewerPRStats(
  reviews: GitHubReviewResponse[],
  inlineComments: InlineComment[],
  reviewerLogins: Set<string>,
): Map<string, ReviewerPRStats> {
  const result = new Map<string, ReviewerPRStats>();

  const inlineByUser = new Map<string, number>();
  for (const c of inlineComments) {
    const login = c.user?.login;
    if (!login) continue;
    inlineByUser.set(login, (inlineByUser.get(login) ?? 0) + 1);
  }

  for (const login of reviewerLogins) {
    const userReviews = reviews
      .filter((r) => r.user?.login === login && r.state !== "PENDING")
      .sort(
        (a, b) =>
          new Date(a.submitted_at).getTime() -
          new Date(b.submitted_at).getTime(),
      );

    let reviewRoundsBeforeApproval: number | null = null;
    let approvedAt: string | null = null;
    for (let i = 0; i < userReviews.length; i++) {
      if (userReviews[i].state === "APPROVED") {
        reviewRoundsBeforeApproval = i + 1;
        approvedAt = userReviews[i].submitted_at;
        break;
      }
    }

    let commentCount = 0;
    for (const r of userReviews) {
      if (r.body && r.body.trim().length > 0) {
        commentCount++;
      }
    }
    commentCount += inlineByUser.get(login) ?? 0;

    result.set(login, {
      reviewRoundsBeforeApproval,
      commentCount,
      reviewSubmissionCount: userReviews.length,
      approvedAt,
    });
  }

  return result;
}

/**
 * Fetches the timeline events and review submissions for a single PR.
 *
 * @param prNumber The PR number to fetch data for.
 * @returns The timeline events and review submissions.
 */
async function fetchPRTimelineAndReviews(prNumber: number): Promise<{
  timelineEvents: TimelineEvent[];
  reviews: GitHubReviewResponse[];
  inlineComments: InlineComment[];
  pullRequest: GitHubPullResponse;
}> {
  const [timelineEvents, reviews, inlineComments, pullRequest] =
    await Promise.all([
      requestGitHubRestAll<TimelineEvent>(
        `/repos/${ORG}/${REPO}/issues/${prNumber}/timeline`,
      ),
      requestGitHubRestAll<GitHubReviewResponse>(
        `/repos/${ORG}/${REPO}/pulls/${prNumber}/reviews`,
      ),
      requestGitHubRestAll<InlineComment>(
        `/repos/${ORG}/${REPO}/pulls/${prNumber}/comments`,
      ),
      requestGitHubRest<GitHubPullResponse>(
        `/repos/${ORG}/${REPO}/pulls/${prNumber}`,
      ),
    ]);
  return { timelineEvents, reviews, inlineComments, pullRequest };
}

const SEARCH_PER_PAGE = 100;
const SEARCH_MAX_PAGES = 10;

type GitHubSearchResponse<T> = {
  items: T[];
  total_count: number;
};

/**
 * Fetches all pages of a GitHub search query.
 *
 * The Search API only exposes the first 1000 results for any query, so we
 * stop after 10 pages of 100 instead of requesting pages GitHub will refuse.
 *
 * @param query The already URL-encoded search query.
 * @param sort The sort field for the results.
 * @returns Every matching item across the fetched pages.
 */
async function searchPullRequests(
  query: string,
  sort: "updated" | "created" = "updated",
): Promise<GitHubPullResponse[]> {
  const items: GitHubPullResponse[] = [];

  for (let page = 1; page <= SEARCH_MAX_PAGES; page++) {
    const searchResult = await requestGitHubRest<
      GitHubSearchResponse<GitHubPullResponse>
    >(
      `/search/issues?q=${query}&sort=${sort}&order=desc&per_page=${SEARCH_PER_PAGE}&page=${page}`,
    );

    items.push(...searchResult.items);

    if (searchResult.items.length < SEARCH_PER_PAGE) break;
    if (items.length >= searchResult.total_count) break;
  }

  return items;
}

/**
 * Fetches open PRs whose `updated` timestamp falls inside the window.
 *
 * @param sinceDate Inclusive start of the window.
 * @param untilDate Optional inclusive end of the window. When omitted, the
 *   window extends to now.
 * @returns The matching open PRs.
 */
export async function fetchOpenPRsForCycleWindow(
  sinceDate: Date,
  untilDate?: Date,
): Promise<GitHubPullResponse[]> {
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);
  const untilDateStr = untilDate?.toISOString().slice(0, 10);
  const updatedFilter = untilDateStr
    ? `updated:${sinceDateStr}..${untilDateStr}`
    : `updated:>=${sinceDateStr}`;

  return searchPullRequests(
    `repo:${ORG}/${REPO}+type:pr+state:open+${updatedFilter}`,
  );
}

/**
 * Fetches PRs whose `closed` timestamp falls inside the window.
 *
 * @param sinceDate Inclusive start of the window.
 * @param untilDate Optional inclusive end of the window. When omitted, the
 *   window extends to now.
 * @returns The matching closed PRs.
 */
export async function fetchClosedPRsForCycleWindow(
  sinceDate: Date,
  untilDate?: Date,
): Promise<GitHubPullResponse[]> {
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);
  const untilDateStr = untilDate?.toISOString().slice(0, 10);
  const closedFilter = untilDateStr
    ? `closed:${sinceDateStr}..${untilDateStr}`
    : `closed:>=${sinceDateStr}`;

  return searchPullRequests(
    `repo:${ORG}/${REPO}+type:pr+state:closed+${closedFilter}`,
  );
}

/**
 * Extracts review cycles for a single PR.
 *
 * PRs without a `pull_request` marker have no cycles and are returned as
 * empty results without any extra API calls. PRs with no current assignees
 * still fetch the timeline so historical assignment cycles are not dropped.
 *
 * @param item The PR search/list item.
 * @param includePending Whether to include pending (unpaired) cycles.
 * @returns The completed cycles, pending cycles, and per-reviewer PR stats.
 */
export async function extractCycleRecordsForPR(
  item: GitHubPullResponse,
  includePending: boolean,
): Promise<{
  completed: CycleRecord[];
  pending: CycleRecordsResult["pending"];
  reviewerPRStats: Map<string, ReviewerPRStats>;
}> {
  if (!item.pull_request) {
    return { completed: [], pending: [], reviewerPRStats: new Map() };
  }

  const { timelineEvents, reviews, inlineComments, pullRequest } =
    await fetchPRTimelineAndReviews(item.number);
  const reviewerLogins = collectCandidateReviewerLogins(item, timelineEvents);

  if (reviewerLogins.size === 0) {
    return { completed: [], pending: [], reviewerPRStats: new Map() };
  }

  const reviewerPRStats = extractReviewerPRStats(
    reviews,
    inlineComments,
    reviewerLogins,
  );
  const result = extractCyclesFromPR(
    item,
    timelineEvents,
    reviews,
    includePending,
    reviewerPRStats,
    pullRequest.additions ?? null,
    reviewerLogins,
  );

  return {
    completed: result.completed,
    pending: result.pending,
    reviewerPRStats,
  };
}

/**
 * Logs the current REST rate limit snapshot.
 *
 * @returns A promise that resolves when the snapshot is logged.
 */
async function logRestRateLimit(): Promise<void> {
  const rate = await fetchGitHubRateLimit();
  console.log("\nRate Limit (REST):");
  console.log(rate.core);
}

/**
 * Extracts cycles for every supplied PR, sequentially.
 *
 * @param items The PRs to process.
 * @param includePending Whether to include pending (unpaired) cycles.
 * @param stateLabel Label used in progress logs.
 * @returns Completed cycles, pending cycles, and per-reviewer PR stats.
 */
async function collectCyclesForPRs(
  items: GitHubPullResponse[],
  includePending: boolean,
  stateLabel: string,
): Promise<CycleRecordsResult> {
  const completed: CycleRecord[] = [];
  const pending: CycleRecordsResult["pending"] = [];
  const reviewerPRStats: CycleRecordsResult["reviewerPRStats"] = new Map();
  const authorLogins = new Set<string>();

  for (const item of items) {
    const author = item.user?.login;
    if (author) {
      authorLogins.add(author);
    }

    if (!item.pull_request) {
      continue;
    }

    console.log(`  Processing ${stateLabel} PR #${item.number}...`);

    const result = await extractCycleRecordsForPR(item, includePending);

    completed.push(...result.completed);
    pending.push(...result.pending);

    for (const [login, prStats] of result.reviewerPRStats) {
      const byPR = reviewerPRStats.get(login) ?? new Map();
      byPR.set(item.number, prStats);
      reviewerPRStats.set(login, byPR);
    }
  }

  return { completed, pending, reviewerPRStats, authorLogins };
}

/**
 * Fetches open PRs updated in the last day and extracts completed review
 * cycles (to persist in reviewCycles) and pending cycles (current open
 * assignments).
 *
 * Uses the GitHub Search API with an `updated:>=` filter so only PRs
 * with recent activity are processed.
 *
 * @param sinceDate Only PRs updated on or after this date are processed.
 *   Defaults to the last 24 hours for the regular incremental sync.
 * @param untilDate Optional inclusive end of the window, used by the
 *   resumable backfill. When omitted, the window extends to now.
 * @returns Completed cycle records, pending cycle info per reviewer, per-PR
 *   reviewer stats, and the authors of the scanned PRs.
 */
export async function fetchCycleRecords(
  sinceDate: Date = new Date(Date.now() - 24 * 60 * 60 * 1000),
  untilDate?: Date,
): Promise<CycleRecordsResult> {
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);
  const untilDateStr = untilDate?.toISOString().slice(0, 10);

  console.log(
    `Fetching cycle records from open PRs updated ${untilDateStr ? `between ${sinceDateStr} and ${untilDateStr}` : `since ${sinceDateStr}`}...`,
  );

  const searchItems = await fetchOpenPRsForCycleWindow(sinceDate, untilDate);

  console.log(
    `Found ${searchItems.length} open PRs updated since ${sinceDateStr}.`,
  );

  const result = await collectCyclesForPRs(searchItems, true, "open");

  await logRestRateLimit();

  return result;
}

/**
 * Fetches PRs closed within the last `sinceDate` and extracts completed
 * review cycles from their timelines.
 *
 * Uses the GitHub Search API to fetch only PRs actually closed in the
 * window (not merely updated).
 *
 * @param sinceDate Only PRs closed on or after this date are processed.
 * @param untilDate Optional inclusive end of the window, used by the
 *   resumable backfill. When omitted, the window extends to now.
 * @returns Completed cycle records, per-PR reviewer stats, and PR authors.
 */
export async function fetchClosedPRCycleRecords(
  sinceDate: Date,
  untilDate?: Date,
): Promise<{
  completed: CycleRecord[];
  reviewerPRStats: Map<string, Map<number, ReviewerPRStats>>;
  authorLogins: Set<string>;
}> {
  const sinceDateStr = sinceDate.toISOString().slice(0, 10);
  const untilDateStr = untilDate?.toISOString().slice(0, 10);

  console.log(
    `Fetching cycle records from PRs closed ${untilDateStr ? `between ${sinceDateStr} and ${untilDateStr}` : `since ${sinceDateStr}`}...`,
  );

  const searchItems = await fetchClosedPRsForCycleWindow(sinceDate, untilDate);

  console.log(`Found ${searchItems.length} closed PRs since ${sinceDateStr}.`);

  const result = await collectCyclesForPRs(searchItems, false, "closed");

  await logRestRateLimit();

  return {
    completed: result.completed,
    reviewerPRStats: result.reviewerPRStats,
    authorLogins: result.authorLogins,
  };
}

/**
 * Fetches the total number of PRs authored by each login in oppia/oppia.
 *
 * Uses one batched GraphQL request with aliased `search` queries so we do
 * not exhaust the REST search rate limit with per-user requests.
 *
 * @param logins The GitHub logins to look up.
 * @returns A map of login to authored PR count.
 */
export async function fetchAuthoredPrCounts(
  logins: string[],
): Promise<Map<string, number>> {
  const uniqueLogins = Array.from(new Set(logins.filter(Boolean)));
  const result = new Map<string, number>();

  if (uniqueLogins.length === 0) return result;

  const CHUNK_SIZE = 20;

  for (let start = 0; start < uniqueLogins.length; start += CHUNK_SIZE) {
    const chunk = uniqueLogins.slice(start, start + CHUNK_SIZE);
    const variables: Record<string, string> = {};

    const variableDefs = chunk.map((_, index) => `$q${index}: String!`);
    const searchFields = chunk.map((login, index) => {
      variables[`q${index}`] = `repo:${ORG}/${REPO} type:pr author:${login}`;
      return `u${index}: search(query: $q${index}, type: ISSUE, first: 1) { issueCount }`;
    });

    const query = `query(${variableDefs.join(", ")}) { ${searchFields.join(" ")} }`;

    const data = await requestGitHubGraphQL<
      Record<string, { issueCount: number }>
    >(query, variables);

    chunk.forEach((login, index) => {
      result.set(login, data[`u${index}`]?.issueCount ?? 0);
    });
  }

  return result;
}
