import type { Issue } from "@/lib/domain/issues.types";
import type { Discussion } from "@/lib/domain/discussions.types";
import type { IssueBucket } from "@/lib/domain/issue-buckets";

export type CategorizedProjectIssues = Record<IssueBucket, Issue[]> & {
  archive: Issue[];
};

export type CategorizedProjectDiscussions = {
  active: Discussion[];
  archive: Discussion[];
};
