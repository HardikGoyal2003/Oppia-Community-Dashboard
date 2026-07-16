export type TriageReviewStatus = "pending" | "accepted" | "edited" | "rejected";

export interface TriageCorrection {
  field: string;
  predicted: string | string[] | boolean;
  corrected: string | string[] | boolean;
}

export interface SimilarIssue {
  number: number;
  title: string;
  score: number;
}

export interface AIPrediction {
  labels: string[];
  newLabels: string[];
  team: string;
  repository: string;
  cuj: string;
  goodFirstIssue: boolean;
  priority: string;
  severity: string;
  confidenceScore: number;
  explanation: string;
  similarIssues: SimilarIssue[];
}

export interface TriagePrediction {
  id: string;
  issueNumber: number;
  issueTitle: string;
  issueUrl: string;
  prediction: AIPrediction;
  existingLabels?: string[];
  status: TriageReviewStatus;
  reviewer?: string;
  reviewedAt?: string;
  corrections?: TriageCorrection[];
  createdAt: string;
  updatedAt: string;
}

export interface TriageFeedback {
  id: string;
  issueId: string;
  issueNumber: number;
  predictionAccuracy: number;
  reviewStatus: TriageReviewStatus;
  reviewer: string;
  changes: TriageCorrection[];
  reviewerNotes?: string;
  createdAt: string;
}

export interface TriageStats {
  totalPredicted: number;
  accepted: number;
  edited: number;
  rejected: number;
  pending: number;
  accuracyRate: number;
}

export const TRIAGE_TEAMS = [
  "Engineering",
  "Product",
  "Design",
  "Community",
  "Docs",
  "Developer Workflow",
  "LEAP",
  "CORE",
  "Infra",
] as const;

export const TRIAGE_REPOSITORIES = [
  "oppia/oppia",
  "oppia/oppia-android",
  "oppia/product-operations",
  "oppia/design",
] as const;

export const TRIAGE_LABELS = [
  "bug",
  "enhancement",
  "feature",
  "documentation",
  "good first issue",
  "impact-high",
  "impact-medium",
  "impact-low",
  "CI breakage",
  "translation",
  "accessibility",
  "performance",
] as const;

export const TRIAGE_CUJS = [
  "Learner Experience",
  "Creator Experience",
  "Translation Review",
  "Community Management",
  "Infrastructure",
  "Onboarding",
  "None",
] as const;

export const TRIAGE_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export const TRIAGE_SEVERITIES = [
  "blocker",
  "major",
  "minor",
  "trivial",
] as const;
