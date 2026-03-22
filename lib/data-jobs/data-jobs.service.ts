import { DbNotFoundError } from "@/db/db.errors";
import {
  getArchivedIssueDocId,
  listArchivedIssueDocumentIds,
  listLegacyArchivedIssues,
  migrateLegacyArchivedIssue,
} from "@/db/archived-issues/archived-issues.db";
import {
  createDataJobRun,
  getDataJobRunById,
  listDataJobRuns,
  markDataJobRunFailed,
  markDataJobRunSucceeded,
} from "@/db/data-jobs/data-job-runs.db";
import { getAllUsers } from "@/db/users/users.db";
import type {
  DataJobDefinition,
  DataJobResult,
  DataJobRun,
} from "@/lib/domain/data-jobs.types";

type DataJobActor = {
  userId: string;
  githubUsername: string;
};

type DataJobHandlerContext = {
  dryRun: boolean;
};

type DataJobHandler = (
  context: DataJobHandlerContext,
) => Promise<DataJobResult>;

type RegisteredDataJob = DataJobDefinition & {
  handler: DataJobHandler;
};

async function auditUsersMissingPlatform(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;
  const users = await getAllUsers();
  const missingPlatformUsers = users.filter((user) => user.platform === null);

  return {
    summary:
      missingPlatformUsers.length === 0
        ? "Audit completed. All users have a platform."
        : `Audit completed. ${missingPlatformUsers.length} users are missing a platform: ${missingPlatformUsers
            .slice(0, 10)
            .map((user) => user.githubUsername)
            .join(", ")}.`,
  };
}

async function auditPrivilegedUsersMissingTeam(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  void context.dryRun;
  const users = await getAllUsers();
  const flaggedUsers = users.filter(
    (user) => user.role !== "CONTRIBUTOR" && user.team === null,
  );

  return {
    summary:
      flaggedUsers.length === 0
        ? "Audit completed. All non-contributor users have a team."
        : `Audit completed. ${flaggedUsers.length} non-contributor users are missing a team: ${flaggedUsers
            .slice(0, 10)
            .map((user) => user.githubUsername)
            .join(", ")}.`,
  };
}

async function migrateArchivedIssuesToPlatformScopedIds(
  context: DataJobHandlerContext,
): Promise<DataJobResult> {
  const legacyIssues = await listLegacyArchivedIssues();

  if (legacyIssues.length === 0) {
    return {
      summary: "Migration completed. No legacy archived issue documents found.",
    };
  }

  const existingDocIds = new Set(await listArchivedIssueDocumentIds());
  const conflicts: string[] = [];
  const invalidDates: string[] = [];
  const migratableIssues = legacyIssues.filter((issue) => {
    const targetId = getArchivedIssueDocId("WEB", issue.issueNumber);
    const parsedDate = new Date(issue.lastCommentCreatedAt);

    if (Number.isNaN(parsedDate.getTime())) {
      invalidDates.push(
        `${issue.id} -> invalid lastCommentCreatedAt: ${issue.lastCommentCreatedAt}`,
      );
      return false;
    }

    if (existingDocIds.has(targetId)) {
      conflicts.push(`${issue.id} -> ${targetId}`);
      return false;
    }

    return true;
  });

  const summaryLines = [
    context.dryRun ? "Dry run completed." : "Migration completed.",
    `Scanned ${legacyIssues.length} legacy archived issue documents.`,
    context.dryRun
      ? `Would migrate ${migratableIssues.length} documents to WEB-scoped ids.`
      : `Migrated ${migratableIssues.length} documents to WEB-scoped ids.`,
    `Conflicts: ${conflicts.length}.`,
    `Invalid timestamps: ${invalidDates.length}.`,
  ];

  if (migratableIssues.length > 0) {
    summaryLines.push(
      `Sample mappings: ${migratableIssues
        .slice(0, 5)
        .map(
          (issue) =>
            `${issue.id} -> ${getArchivedIssueDocId("WEB", issue.issueNumber)}`,
        )
        .join(", ")}.`,
    );
  }

  if (conflicts.length > 0) {
    summaryLines.push(`Conflict samples: ${conflicts.slice(0, 5).join(", ")}.`);
  }

  if (invalidDates.length > 0) {
    summaryLines.push(
      `Invalid timestamp samples: ${invalidDates.slice(0, 5).join(", ")}.`,
    );
  }

  if (!context.dryRun) {
    for (const issue of migratableIssues) {
      await migrateLegacyArchivedIssue(issue, "WEB");
    }
  }

  return {
    summary: summaryLines.join("\n"),
  };
}

const DATA_JOB_REGISTRY: RegisteredDataJob[] = [
  {
    key: "audit_users_missing_platform",
    name: "Audit Users Missing Platform",
    description:
      "Scans users and reports accounts that still do not have a selected platform.",
    kind: "AUDIT",
    supportsDryRun: true,
    handler: auditUsersMissingPlatform,
  },
  {
    key: "audit_privileged_users_missing_team",
    name: "Audit Privileged Users Missing Team",
    description:
      "Scans non-contributor users and reports accounts that are missing a team assignment.",
    kind: "AUDIT",
    supportsDryRun: true,
    handler: auditPrivilegedUsersMissingTeam,
  },
  {
    key: "migrate_archived_issues_to_platform_scoped_ids",
    name: "Migrate Archived Issues To Platform-Scoped Ids",
    description:
      "Migrates legacy archived issue documents from `${issueNumber}` ids to `WEB_${issueNumber}`, adds platform=WEB, and converts lastCommentCreatedAt to Timestamp.",
    kind: "MIGRATION",
    supportsDryRun: true,
    handler: migrateArchivedIssuesToPlatformScopedIds,
  },
];

/**
 * Lists the available data jobs exposed in the control panel.
 *
 * @returns The registered data jobs without their handlers.
 */
export function listAvailableDataJobs(): DataJobDefinition[] {
  return DATA_JOB_REGISTRY.map((job) => {
    return {
      key: job.key,
      name: job.name,
      description: job.description,
      kind: job.kind,
      supportsDryRun: job.supportsDryRun,
    };
  });
}

/**
 * Lists recent data-job runs for the control panel.
 *
 * @returns The recent persisted data-job runs.
 */
export async function listRecentDataJobRuns(): Promise<DataJobRun[]> {
  return listDataJobRuns();
}

/**
 * Executes a registered data job and persists its run history.
 *
 * @param jobKey The registered data job key.
 * @param actor The user who triggered the job.
 * @param dryRun Whether the job should run in dry-run mode.
 * @returns The persisted data-job run after completion.
 */
export async function runDataJob(
  jobKey: string,
  actor: DataJobActor,
  dryRun: boolean,
): Promise<DataJobRun> {
  const job = DATA_JOB_REGISTRY.find((candidate) => candidate.key === jobKey);

  if (!job) {
    throw new DbNotFoundError("Data job", `Data job ${jobKey} not found.`);
  }

  const runId = await createDataJobRun({
    jobKey: job.key,
    jobName: job.name,
    kind: job.kind,
    status: "RUNNING",
    dryRun,
    triggeredByUserId: actor.userId,
    triggeredByGithubUsername: actor.githubUsername,
    summary: "Job started.",
    errorMessage: null,
    startedAt: new Date(),
    finishedAt: null,
  });

  try {
    const result = await job.handler({ dryRun });
    await markDataJobRunSucceeded(runId, result.summary);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Data job failed.";
    await markDataJobRunFailed(runId, errorMessage);
    throw error;
  }

  return getDataJobRunById(runId);
}
