import type { Issue } from "@/lib/domain/issues.types";
import type { IssueBucket } from "@/lib/domain/issue-buckets";

export type CategorizedProjectIssues = Record<IssueBucket, Issue[]> & {
  archive: Issue[];
};
