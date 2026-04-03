import { DbNotFoundError } from "@/db/db.errors";
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

/**
 * Audits users and reports accounts that do not yet have a selected platform.
 *
 * @param context The data-job execution context.
 * @returns A summary of the audit findings.
 */
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

/**
 * Audits non-contributor users and reports accounts that are missing a team assignment.
 *
 * @param context The data-job execution context.
 * @returns A summary of the audit findings.
 */
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
