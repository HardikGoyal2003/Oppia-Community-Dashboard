export type DataJobKind = "AUDIT" | "BACKFILL" | "MIGRATION" | "CLEANUP";

export type DataJobRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface DataJobDefinition {
  key: string;
  name: string;
  description: string;
  kind: DataJobKind;
  supportsDryRun: boolean;
}

export interface DataJobRun {
  id: string;
  jobKey: string;
  jobName: string;
  kind: DataJobKind;
  status: DataJobRunStatus;
  dryRun: boolean;
  triggeredByUserId: string;
  triggeredByGithubUsername: string;
  summary: string;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

export interface DataJobResult {
  summary: string;
}
