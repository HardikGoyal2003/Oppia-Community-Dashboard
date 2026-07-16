import type {
  TriagePrediction,
  TriageStats,
  TriageCorrection,
} from "@/lib/issue-triage/issue-triage.types";

export async function fetchTriageIssues(
  status?: string,
): Promise<TriagePrediction[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);

  const res = await fetch(`/api/issue-triage?${params.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch triage issues");
  }

  const data = (await res.json()) as { issues: TriagePrediction[] };
  return data.issues;
}

export async function fetchTriageStats(): Promise<TriageStats> {
  const res = await fetch("/api/issue-triage?stats=true", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch triage stats");
  }

  const data = (await res.json()) as { stats: TriageStats };
  return data.stats;
}

export async function submitTriageAction(
  issueNumber: number,
  action: "accept" | "edit" | "reject",
  corrections?: TriageCorrection[],
): Promise<{ labelsApplied?: string[]; triageLabelRemoved?: boolean } | void> {
  const res = await fetch("/api/issue-triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      issueNumber,
      corrections,
    }),
  });

  if (!res.ok) {
    const data = (await res.json()) as { error: string };
    throw new Error(data.error || "Failed to submit triage action");
  }

  const data = await res.json();
  return data;
}

export interface UntriagedIssue {
  number: number;
  title: string;
  url: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  body: string;
  author: string;
}

export async function fetchUntriagedIssues(
  page = 1,
  perPage = 20,
): Promise<{
  issues: UntriagedIssue[];
  totalGitHub: number;
  totalTriaged: number;
}> {
  const res = await fetch(
    `/api/issue-triage/untriaged?page=${page}&per_page=${perPage}`,
    { cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error("Failed to fetch untriaged issues");
  }

  return res.json();
}

export async function triggerTriage(
  issueNumber: number,
  issueTitle: string,
  issueUrl: string,
  issueBody: string,
  labels: string[],
): Promise<void> {
  const res = await fetch("http://localhost:8000/triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      issue: {
        issueNumber,
        issueTitle,
        issueUrl,
        issueBody,
        labels,
      },
    }),
    signal: AbortSignal.timeout(150000),
  });

  if (!res.ok) {
    throw new Error("AI triage backend returned an error");
  }

  const prediction = await res.json();

  const saveRes = await fetch("/api/issue-triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create",
      issueNumber,
      issueTitle,
      issueUrl,
      prediction: {
        labels: prediction.labels,
        newLabels: prediction.newLabels || [],
        team: prediction.team,
        repository: prediction.repository,
        cuj: prediction.cuj,
        goodFirstIssue: prediction.goodFirstIssue,
        priority: prediction.priority,
        severity: prediction.severity,
        confidenceScore: prediction.confidenceScore,
        explanation: prediction.explanation,
        similarIssues: prediction.similarIssues,
      },
    }),
  });

  if (!saveRes.ok) {
    throw new Error("Failed to save triage prediction");
  }
}

export interface BatchTriageResult {
  message: string;
  triaged: number;
  failed: number;
  total: number;
  untriaged?: number;
}

export async function batchTriageAll(): Promise<BatchTriageResult> {
  const res = await fetch("/api/issue-triage/batch-triage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(600000),
  });

  if (!res.ok) {
    throw new Error("Batch triage failed");
  }

  return res.json();
}

export async function submitTriageFeedback(
  issueNumber: number,
  issueId: string,
  predictionAccuracy: number,
  reviewStatus: "accepted" | "edited" | "rejected",
  changes: TriageCorrection[],
  reviewerNotes?: string,
): Promise<string> {
  const res = await fetch("/api/issue-triage/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      issueNumber,
      issueId,
      predictionAccuracy,
      reviewStatus,
      changes,
      reviewerNotes,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to submit feedback");
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}
