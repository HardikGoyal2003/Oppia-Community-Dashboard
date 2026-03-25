export const CONSTANTS = {
  WEB_TEAMS: {
    CORE: "[Web] CORE Team (Creators, Operations, Reviewers and Editors)",
    LEAP: "[Web] LEAP Team (Learners, Educators, Allies, and Parents)",
    DEV_WORKFLOW: "[Web] Developer Workflow Team",
  },

  ANDROID_TEAMS: {
    CLAM: "[Android] CLAM Team (Core Learner and Mastery & UI Frontend)",
    DEV_WORKFLOW_INFRA: "[Android] Developer Workflow & Infrastructure Team",
  },

  GITHUB_REPOS: {
    WEB: { owner: "oppia", repo: "oppia" },
    ANDROID: { owner: "oppia", repo: "oppia-android" },
  },

  CONTRIBUTING_DOCS: {
    WEB: "https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia",
    ANDROID:
      "https://github.com/oppia/oppia-android/wiki/Contributing-to-Oppia-android",
  },

  ANNOUNCEMENT_BANNER: {
    // TITLE: "🚧 Scheduled maintenance:",
    // MESSAGE:
    //   "Our website will be temporarily unavailable on [date] from [start time] to [end time]. Thank you for your understanding.",
    TITLE: "🎉 New version is live:",
    MESSAGE:
      "Explore the latest Oppia Community Dashboard and feel free to share your feedback or any bug reports.",
    IS_ENABLED: true,
  },

  ROLES: {
    SUPER_ADMIN: "Super Admin",
    CONTRIBUTOR: "Contributor",
    TEAM_MEMBER: "Team Member",
    LEAD_TRAINEE: "Lead Trainee",
    TEAM_LEAD: "Team Lead",
    ADMIN: "Admin",
  },
} as const;
