export const DB_PATHS = {
  ANNOUNCEMENTS: {
    COLLECTION: "announcements",
    GLOBAL_BANNER_DOC_ID: "global-banner",
  },
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
