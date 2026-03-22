import type { Issue } from "@/lib/domain/issues.types";

export interface CategorizedProjectIssues {
  team1: Issue[];
  team2: Issue[];
  team3: Issue[];
  others: Issue[];
  archive: Issue[];
}
