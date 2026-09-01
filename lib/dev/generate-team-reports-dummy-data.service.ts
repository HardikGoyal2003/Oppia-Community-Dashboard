import { createDailyTeamMetric } from "@/db/team-metrics/daily-team-metrics.db";
import { upsertTeam } from "@/db/teams/teams.db";
import { TEAM_DEFINITIONS } from "@/lib/domain/team-definitions";
import type {
  TeamGfiCounts,
  TeamLead,
  TeamMember,
} from "@/lib/domain/teams.types";
import { getIstDateKey } from "@/lib/utils/date.utils";

type DummyDataGenerationSummary = {
  metricsWritten: number;
  teamsWritten: number;
};

const SAMPLE_LEADS: Record<string, TeamLead[]> = {
  ANDROID_CLAM: [
    {
      role: "TEAM_LEAD",
      uid: "sample-android-clam-1",
      username: "clam_lead",
    },
    {
      role: "LEAD_TRAINEE",
      uid: "sample-android-clam-2",
      username: "mobile_mentor",
    },
  ],
  ANDROID_DEV_WORKFLOW_INFRA: [
    {
      role: "TEAM_LEAD",
      uid: "sample-android-dev-1",
      username: "infra_android",
    },
  ],
  WEB_CORE: [
    {
      role: "TEAM_LEAD",
      uid: "sample-web-core-1",
      username: "core_lead",
    },
    {
      role: "LEAD_TRAINEE",
      uid: "sample-web-core-2",
      username: "creator_ops",
    },
  ],
  WEB_DEV_WORKFLOW: [
    {
      role: "TEAM_LEAD",
      uid: "sample-web-dev-1",
      username: "web_workflow",
    },
  ],
  WEB_LEAP: [
    {
      role: "TEAM_LEAD",
      uid: "sample-web-leap-1",
      username: "leap_lead",
    },
    {
      role: "LEAD_TRAINEE",
      uid: "sample-web-leap-2",
      username: "educator_ally",
    },
  ],
};

const SAMPLE_MEMBERS: Record<string, TeamMember[]> = {
  ANDROID_CLAM: [
    { uid: "sample-android-clam-m1", username: "android_builder" },
    { uid: "sample-android-clam-m2", username: "ui_qa" },
    { uid: "sample-android-clam-m3", username: "kotlin_fan" },
    { uid: "sample-android-clam-m4", username: "gradle_whiz" },
  ],
  ANDROID_DEV_WORKFLOW_INFRA: [
    { uid: "sample-android-dev-m1", username: "ci_architect" },
    { uid: "sample-android-dev-m2", username: "release_engineer" },
  ],
  WEB_CORE: [
    { uid: "sample-web-core-m1", username: "core_contributor" },
    { uid: "sample-web-core-m2", username: "review_helper" },
    { uid: "sample-web-core-m3", username: "docs_owner" },
    { uid: "sample-web-core-m4", username: "ts_lover" },
    { uid: "sample-web-core-m5", username: "test_writer" },
  ],
  WEB_DEV_WORKFLOW: [
    { uid: "sample-web-dev-m1", username: "devops_gal" },
    { uid: "sample-web-dev-m2", username: "lint_fixer" },
    { uid: "sample-web-dev-m3", username: "storybook_dev" },
  ],
  WEB_LEAP: [
    { uid: "sample-web-leap-m1", username: "learner_advocate" },
    { uid: "sample-web-leap-m2", username: "educator_partner" },
    { uid: "sample-web-leap-m3", username: "curriculum_pal" },
    { uid: "sample-web-leap-m4", username: "ally_network" },
  ],
};

const SAMPLE_GFI_COUNTS: Record<string, TeamGfiCounts> = {
  ANDROID_CLAM: {
    backend: 1,
    frontend: 4,
    fullstack: 1,
    uncategorized: 0,
  },
  ANDROID_DEV_WORKFLOW_INFRA: {
    backend: 3,
    frontend: 0,
    fullstack: 2,
    uncategorized: 1,
  },
  WEB_CORE: {
    backend: 4,
    frontend: 6,
    fullstack: 3,
    uncategorized: 1,
  },
  WEB_DEV_WORKFLOW: {
    backend: 5,
    frontend: 2,
    fullstack: 3,
    uncategorized: 0,
  },
  WEB_LEAP: {
    backend: 2,
    frontend: 7,
    fullstack: 2,
    uncategorized: 1,
  },
};

const SAMPLE_UNANSWERED_ISSUES: Record<string, number[]> = {
  ANDROID_CLAM: [4, 5, 5, 6, 7, 6, 8, 9, 8, 10],
  ANDROID_DEV_WORKFLOW_INFRA: [2, 2, 3, 4, 4, 5, 6, 6, 7, 7],
  WEB_CORE: [8, 9, 11, 12, 13, 12, 14, 15, 16, 17],
  WEB_DEV_WORKFLOW: [3, 4, 4, 5, 6, 7, 7, 8, 9, 9],
  WEB_LEAP: [6, 7, 8, 8, 9, 10, 11, 12, 12, 13],
};

/**
 * Builds a deterministic snapshot timestamp for a sample day offset.
 *
 * @param daysAgo The number of days before today to target.
 * @returns The fixed snapshot timestamp for that sample day.
 */
function getFixedIstCaptureDate(daysAgo: number): Date {
  const now = new Date();
  const target = new Date(now);
  target.setDate(target.getDate() - daysAgo);

  return new Date(
    Date.UTC(
      target.getUTCFullYear(),
      target.getUTCMonth(),
      target.getUTCDate(),
      6,
      30,
      0,
      0,
    ),
  );
}

/**
 * Seeds deterministic sample teams and daily team metrics for local chart development.
 *
 * @returns A summary of the written team and metric documents.
 */
export async function generateTeamReportsDummyData(): Promise<DummyDataGenerationSummary> {
  const lastUpdated = new Date();

  await Promise.all(
    TEAM_DEFINITIONS.map((team) =>
      upsertTeam(team.teamId, {
        gfiCounts: SAMPLE_GFI_COUNTS[team.teamId],
        lastUpdated,
        leads: SAMPLE_LEADS[team.teamId] ?? [],
        members: SAMPLE_MEMBERS[team.teamId] ?? [],
        platform: team.platform,
        teamName: team.teamName,
      }),
    ),
  );

  let metricsWritten = 0;

  for (const team of TEAM_DEFINITIONS) {
    const series = SAMPLE_UNANSWERED_ISSUES[team.teamId] ?? [];

    for (const [index, unansweredIssuesCount] of series.entries()) {
      const capturedAt = getFixedIstCaptureDate(series.length - index - 1);

      await createDailyTeamMetric({
        capturedAt,
        dateKey: getIstDateKey(capturedAt),
        platform: team.platform,
        teamId: team.teamId,
        teamName: team.teamName,
        unansweredIssuesCount,
      });

      metricsWritten += 1;
    }
  }

  return {
    metricsWritten,
    teamsWritten: TEAM_DEFINITIONS.length,
  };
}
