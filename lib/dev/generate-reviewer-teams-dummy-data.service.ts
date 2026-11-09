import { upsertTeamReviewers } from "@/db/team-reviewers/team-reviewers.db";
import { upsertReviewer } from "@/db/reviewers/reviewers.db";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import type {
  PendingReview,
  ReviewerDocument,
  TeamReviewersDocument,
} from "@/lib/domain/reviewer-teams.types";

export type ReviewerTeamsDummyDataSummary = {
  teamsWritten: number;
  reviewersWritten: number;
  pendingReviewsWritten: number;
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

  for (const [username, teams] of reviewerToTeams) {
    const sample = reviewerToSample.get(username);

    if (!sample) {
      continue;
    }

    const pendingReviews: PendingReview[] = sample.pendingPrs.map((pr) => ({
      prNumber: pr.prNumber,
      title: pr.title,
      url: `https://github.com/oppia/oppia/pull/${pr.prNumber}`,
      assignedAt: new Date(now - pr.hoursAgo * 3_600_000).toISOString(),
    }));

    const doc: ReviewerDocument = {
      teams: Array.from(teams).sort(),
      pendingReviews,
      completedReviews: sample.completedReviews,
      approvedPrCount: sample.approvedPrCount,
      avgReviewTimeHours: sample.avgReviewTimeHours,
      avgReviewRoundsBeforeApproval: sample.avgReviewRoundsBeforeApproval,
      avgCommentsPerReview: sample.avgCommentsPerReview,
      lastUpdated,
    };

    await upsertReviewer(username, doc);
    pendingReviewsWritten += pendingReviews.length;
  }

  return {
    teamsWritten: SAMPLE_TEAMS.length,
    reviewersWritten: reviewerToTeams.size,
    pendingReviewsWritten,
  };
}
