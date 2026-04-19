export const DB_PATHS = {
  ARCHIVED_ISSUES: {
    COLLECTION: "archivedIssues",
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
  TEAMS: {
    COLLECTION: "teams",
  },
  DAILY_TEAM_METRICS: {
    COLLECTION: "dailyTeamMetrics",
  },
  USERS: {
    COLLECTION: "users",
    NOTIFICATIONS_SUBCOLLECTION: "notifications",
  },
} as const;
