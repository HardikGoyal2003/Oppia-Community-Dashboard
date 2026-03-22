export const DB_PATHS = {
  ARCHIVED_ISSUES: {
    COLLECTION: "archivedIssues",
  },
  MEMBER_ACCESS_REQUESTS: {
    COLLECTION: "memberAccessRequests",
  },
  USERS: {
    COLLECTION: "users",
    NOTIFICATIONS_SUBCOLLECTION: "notifications",
  },
} as const;
