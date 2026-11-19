export const DB_PATHS = Object.freeze({
  ARCHIVED_ISSUES: Object.freeze({
    COLLECTION: "archivedIssues",
  }),
  ARCHIVED_DISCUSSIONS: Object.freeze({
    COLLECTION: "archivedDiscussions",
  }),
  DATA_JOB_RUNS: Object.freeze({
    COLLECTION: "dataJobRuns",
  }),
  USER_JOURNEY_PROGRESS: Object.freeze({
    COLLECTION: "userJourneyProgress",
  }),
  MEMBER_ACCESS_REQUESTS: Object.freeze({
    COLLECTION: "memberAccessRequests",
  }),
  ACTION_ITEMS: Object.freeze({
    COLLECTION: "actionItems",
  }),
  NOTIFICATION_DELIVERIES: Object.freeze({
    COLLECTION: "notificationDeliveries",
  }),
  UNREGISTERED_MEMBERS: Object.freeze({
    COLLECTION: "unregisteredMembers",
  }),
  TEAMS: Object.freeze({
    COLLECTION: "teams",
  }),
  DAILY_TEAM_METRICS: Object.freeze({
    COLLECTION: "dailyTeamMetrics",
  }),
  DAILY_DISCUSSION_METRICS: Object.freeze({
    COLLECTION: "dailyDiscussionMetrics",
  }),
  USERS: Object.freeze({
    COLLECTION: "users",
    NOTIFICATIONS_SUBCOLLECTION: "notifications",
  }),
  ORG_META: Object.freeze({
    COLLECTION: "orgMeta",
  }),
  TEAM_REVIEWERS: Object.freeze({
    COLLECTION: "teamReviewers",
  }),
  REVIEWERS: Object.freeze({
    COLLECTION: "reviewers",
  }),
  REVIEW_CYCLES: Object.freeze({
    COLLECTION: "reviewCycles",
  }),
  REVIEWER_CYCLE_AGGREGATES: Object.freeze({
    COLLECTION: "reviewerCycleAggregates",
  }),
  REVIEW_CYCLE_PR_STATS: Object.freeze({
    COLLECTION: "reviewCyclePrStats",
  }),
  REVIEW_CYCLE_MONTHLY_REVIEWERS: Object.freeze({
    COLLECTION: "reviewCycleMonthlyReviewers",
  }),
  REVIEW_CYCLE_ANALYTICS: Object.freeze({
    COLLECTION: "reviewCycleAnalytics",
    SNAPSHOT_DOC: "WEB",
  }),
  REVIEW_CYCLE_BACKFILL: Object.freeze({
    COLLECTION: "reviewCycleBackfill",
    STATE_DOC: "state",
  }),
});
