export type CronJobDefinition = {
  description: string;
  key: string;
  name: string;
};

export type CronJobRunResult = {
  finishedAt: Date;
  jobKey: string;
  jobName: string;
  startedAt: Date;
  summary: string;
};
