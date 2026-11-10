import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { upsertReviewer } from "@/db/reviewers/reviewers.db";
import { upsertReviewCycles } from "@/db/review-cycles/review-cycles.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  PendingReview,
  ReviewCycleRecord,
  ReviewerDocument,
  TeamReviewersDocument,
} from "@/lib/domain/reviewer-teams.types";

export type ReviewerTeamsDummyDataSummary = {
  teamsWritten: number;
  reviewersWritten: number;
  pendingReviewsWritten: number;
  cyclesWritten: number;
};

type SamplePendingPr = {
  prNumber: number;
  title: string;
  hoursAgo: number;
};

type SampleReviewer = {
  username: string;
  completedReviews: number;
  approvedPrCount: number;
  avgReviewTimeHours: number | null;
  avgReviewRoundsBeforeApproval: number | null;
  avgCommentsPerReview: number | null;
  pendingPrs: SamplePendingPr[];
};

type SampleReviewerTeam = {
  teamSlug: string;
  teamName: string;
  description: string;
  members: SampleReviewer[];
};

const SAMPLE_TEAMS: SampleReviewerTeam[] = [
  {
    teamSlug: "web-core-reviewers",
    teamName: "Web Core Reviewers",
    description: "Reviews core web platform changes.",
    members: [
      {
        username: "priya_reviews",
        completedReviews: 42,
        approvedPrCount: 30,
        avgReviewTimeHours: 18.5,
        avgReviewRoundsBeforeApproval: 1.8,
        avgCommentsPerReview: 4.2,
        pendingPrs: [
          { prNumber: 23101, title: "Fix exploration state sync", hoursAgo: 5 },
          { prNumber: 23144, title: "Add topic editor guard", hoursAgo: 26 },
        ],
      },
      {
        username: "arjun_code",
        completedReviews: 27,
        approvedPrCount: 19,
        avgReviewTimeHours: 31,
        avgReviewRoundsBeforeApproval: 2.3,
        avgCommentsPerReview: 3.1,
        pendingPrs: [
          { prNumber: 23166, title: "Refactor story player", hoursAgo: 3 },
        ],
      },
      {
        username: "meera_dev",
        completedReviews: 15,
        approvedPrCount: 10,
        avgReviewTimeHours: 47.5,
        avgReviewRoundsBeforeApproval: 2.6,
        avgCommentsPerReview: 2.4,
        pendingPrs: [],
      },
    ],
  },
  {
    teamSlug: "web-frontend-reviewers",
    teamName: "Web Frontend Reviewers",
    description: "Reviews Angular and UI changes.",
    members: [
      {
        username: "sam_ui",
        completedReviews: 33,
        approvedPrCount: 25,
        avgReviewTimeHours: 22,
        avgReviewRoundsBeforeApproval: 1.6,
        avgCommentsPerReview: 5.8,
        pendingPrs: [
          {
            prNumber: 23188,
            title: "Improve lesson card layout",
            hoursAgo: 9,
          },
        ],
      },
      {
        username: "nina_css",
        completedReviews: 21,
        approvedPrCount: 14,
        avgReviewTimeHours: null,
        avgReviewRoundsBeforeApproval: null,
        avgCommentsPerReview: 3.3,
        pendingPrs: [],
      },
      {
        username: "rahul_ts",
        completedReviews: 38,
        approvedPrCount: 29,
        avgReviewTimeHours: 14.5,
        avgReviewRoundsBeforeApproval: 1.4,
        avgCommentsPerReview: 6.1,
        pendingPrs: [
          {
            prNumber: 23190,
            title: "Migrate to standalone components",
            hoursAgo: 2,
          },
          { prNumber: 23201, title: "Fix a11y focus ring", hoursAgo: 31 },
        ],
      },
    ],
  },
  {
    teamSlug: "web-backend-reviewers",
    teamName: "Web Backend Reviewers",
    description: "Reviews storage and API changes.",
    members: [
      {
        username: "dev_api",
        completedReviews: 46,
        approvedPrCount: 34,
        avgReviewTimeHours: 26,
        avgReviewRoundsBeforeApproval: 2,
        avgCommentsPerReview: 4.7,
        pendingPrs: [
          {
            prNumber: 23102,
            title: "Add discussion archive endpoint",
            hoursAgo: 7,
          },
        ],
      },
      {
        username: "kavya_db",
        completedReviews: 12,
        approvedPrCount: 8,
        avgReviewTimeHours: 39,
        avgReviewRoundsBeforeApproval: 2.9,
        avgCommentsPerReview: 2.1,
        pendingPrs: [],
      },
      {
        username: "omar_cloud",
        completedReviews: 29,
        approvedPrCount: 22,
        avgReviewTimeHours: null,
        avgReviewRoundsBeforeApproval: null,
        avgCommentsPerReview: null,
        pendingPrs: [
          {
            prNumber: 23155,
            title: "Batch Firestore writes",
            hoursAgo: 19,
          },
        ],
      },
    ],
  },
  {
    teamSlug: "web-testing-reviewers",
    teamName: "Web Testing Reviewers",
    description: "Reviews e2e and unit test changes.",
    members: [
      {
        username: "tara_qa",
        completedReviews: 24,
        approvedPrCount: 18,
        avgReviewTimeHours: 11.5,
        avgReviewRoundsBeforeApproval: 1.3,
        avgCommentsPerReview: 3.9,
        pendingPrs: [],
      },
      {
        username: "vik_test",
        completedReviews: 9,
        approvedPrCount: 6,
        avgReviewTimeHours: 52,
        avgReviewRoundsBeforeApproval: 3.1,
        avgCommentsPerReview: 1.8,
        pendingPrs: [
          {
            prNumber: 23133,
            title: "Stabilize flaky e2e suite",
            hoursAgo: 44,
          },
        ],
      },
    ],
  },
];

/**
 * Builds a deterministic avatar URL for a sample reviewer.
 *
 * @param username The sample reviewer's GitHub login.
 * @returns The avatar URL.
 */
function buildAvatarUrl(username: string): string {
  return `https://github.com/identicons/${encodeURIComponent(username)}.png`;
}

/**
 * Seeds deterministic sample reviewer teams, reviewer stats, and pending
 * reviews for local UI development of the Reviewer Reports tab.
 *
 * @returns A summary of the written reviewer documents.
 */
export async function generateReviewerTeamsDummyData(): Promise<ReviewerTeamsDummyDataSummary> {
  const platform: ContributionPlatform = "WEB";
  const lastUpdated = new Date();
  const now = Date.now();

  const teamDoc: TeamReviewersDocument = {
    teams: SAMPLE_TEAMS.map((team) => ({
      teamSlug: team.teamSlug,
      teamName: team.teamName,
      description: team.description,
      members: team.members.map((member) => ({
        username: member.username,
        avatarUrl: buildAvatarUrl(member.username),
      })),
    })),
    lastUpdated,
  };

  await upsertTeamReviewers(platform, teamDoc);

  const reviewerToTeams = new Map<string, Set<string>>();
  const reviewerToSample = new Map<string, SampleReviewer>();

  for (const team of SAMPLE_TEAMS) {
    for (const member of team.members) {
      const teams = reviewerToTeams.get(member.username) ?? new Set<string>();
      teams.add(team.teamSlug);
      reviewerToTeams.set(member.username, teams);

      if (!reviewerToSample.has(member.username)) {
        reviewerToSample.set(member.username, member);
      }
    }
  }

  let pendingReviewsWritten = 0;
  const cycles: ReviewCycleRecord[] = [];
  const hourMs = 3_600_000;
  const dayMs = 24 * hourMs;
  let nextSamplePrNumber = 23_200;
  let memberIndex = 0;

  for (const [username, teams] of reviewerToTeams) {
    const sample = reviewerToSample.get(username);

    if (!sample) {
      continue;
    }

    const member = memberIndex++;

    const pendingReviews: PendingReview[] = sample.pendingPrs.map((pr) => ({
      prNumber: pr.prNumber,
      title: pr.title,
      url: `https://github.com/oppia/oppia/pull/${pr.prNumber}`,
      assignedAt: new Date(now - pr.hoursAgo * hourMs).toISOString(),
    }));

    const reviewedPrCount = Math.max(
      1,
      Math.round(sample.completedReviews * 0.8),
    );
    const completedReviewSubmissions =
      Math.round(sample.completedReviews * 1.4) + (member % 5);
    const authoredPrCount = Math.max(
      1,
      Math.round(sample.approvedPrCount * (0.5 + (member % 4) * 0.15)),
    );

    const doc: ReviewerDocument = {
      teams: Array.from(teams).sort(),
      pendingReviews,
      completedReviews: sample.completedReviews,
      reviewedPrCount,
      completedReviewSubmissions,
      approvedPrCount: sample.approvedPrCount,
      authoredPrCount,
      avgReviewTimeHours: sample.avgReviewTimeHours,
      avgTimeToApprovalHours:
        sample.avgReviewTimeHours !== null
          ? Number((sample.avgReviewTimeHours * 1.6).toFixed(1))
          : null,
      avgReviewRoundsBeforeApproval: sample.avgReviewRoundsBeforeApproval,
      avgCommentsPerReview: sample.avgCommentsPerReview,
      avgReviewsPerWeek: Number((completedReviewSubmissions / 18).toFixed(2)),
      lastUpdated,
    };

    await upsertReviewer(username, doc);
    pendingReviewsWritten += pendingReviews.length;

    const cycleCount = 6 + (member % 6);

    for (let i = 0; i < cycleCount; i++) {
      const prNumber = nextSamplePrNumber++;
      const daysAgo = 3 + i * 6 + (member % 5);
      const assignedMs = now - daysAgo * dayMs - member * 37 * 60_000;
      const durationHours = 5 + ((member * 7 + i * 11) % 70);
      const approved = (member + i) % 3 !== 0;
      const approvedAtMs = approved
        ? assignedMs + (durationHours + 3 + (i % 5)) * hourMs
        : null;

      cycles.push({
        reviewerLogin: username,
        prNumber,
        prTitle: `Sample PR #${prNumber}`,
        prUrl: `https://github.com/oppia/oppia/pull/${prNumber}`,
        assignedAt: new Date(assignedMs).toISOString(),
        completedAt: new Date(
          assignedMs + durationHours * hourMs,
        ).toISOString(),
        durationMs: durationHours * hourMs,
        reviewRoundsBeforeApproval: approved ? 1 + ((member + i) % 3) : null,
        commentCount: 1 + ((member * 2 + i) % 7),
        reviewSubmissionCount: 1 + ((member + i) % 3),
        approvedAt:
          approvedAtMs !== null ? new Date(approvedAtMs).toISOString() : null,
        approvalDurationMs:
          approvedAtMs !== null ? approvedAtMs - assignedMs : null,
        prAdditions: [80, 150, 240, 320, 480][(member + i) % 5],
      });
    }
  }

  await upsertReviewCycles(cycles);

  return {
    teamsWritten: SAMPLE_TEAMS.length,
    reviewersWritten: reviewerToTeams.size,
    pendingReviewsWritten,
    cyclesWritten: cycles.length,
  };
}
