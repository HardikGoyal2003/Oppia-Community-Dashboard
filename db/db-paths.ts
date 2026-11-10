export const DB_PATHS = {
  ARCHIVED_ISSUES: {
    COLLECTION: "archivedIssues",
  },
  ARCHIVED_DISCUSSIONS: {
    COLLECTION: "archivedDiscussions",
  },
  DATA_JOB_RUNS: {
    COLLECTION: "dataJobRuns",
  },
  USER_JOURNEY_PROGRESS: {
    COLLECTION: "userJourneyProgress",
  },
  MEMBER_ACCESS_REQUESTS: {
    COLLECTION: "memberAccessRequests",
  },
  ACTION_ITEMS: {
    COLLECTION: "actionItems",
  },
  NOTIFICATION_DELIVERIES: {
    COLLECTION: "notificationDeliveries",
  },
  TEAMS: {
    COLLECTION: "teams",
  },
  DAILY_TEAM_METRICS: {
    COLLECTION: "dailyTeamMetrics",
  },
  DAILY_DISCUSSION_METRICS: {
    COLLECTION: "dailyDiscussionMetrics",
  },
  USERS: {
    COLLECTION: "users",
    NOTIFICATIONS_SUBCOLLECTION: "notifications",
  },
  ORG_META: {
    COLLECTION: "orgMeta",
  },
  TEAM_REVIEWERS: {
    COLLECTION: "teamReviewers",
  },
  REVIEWERS: {
    COLLECTION: "reviewers",
  },
  REVIEW_CYCLES: {
    COLLECTION: "reviewCycles",
  },
  REVIEW_CYCLE_ANALYTICS: {
    COLLECTION: "reviewCycleAnalytics",
    SNAPSHOT_DOC: "WEB",
  },
  REVIEW_CYCLE_BACKFILL: {
    COLLECTION: "reviewCycleBackfill",
    STATE_DOC: "state",
  },
} as const;
