import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import type {
  TriagePrediction,
  TriageFeedback,
  TriageReviewStatus,
  TriageCorrection,
  TriageStats,
  AIPrediction,
} from "@/lib/issue-triage/issue-triage.types";

/**
 * Returns the triage predictions Firestore collection.
 * @returns Firestore collection reference for triage predictions.
 */
function triageCollection() {
  return getAdminFirestore().collection(DB_PATHS.ISSUE_TRIAGE.COLLECTION);
}

/**
 * Returns the triage feedback Firestore collection.
 * @returns Firestore collection reference for triage feedback.
 */
function feedbackCollection() {
  return getAdminFirestore().collection(
    DB_PATHS.ISSUE_TRIAGE_FEEDBACK.COLLECTION,
  );
}

/**
 * Fetch all pending triage issues ordered by creation date descending.
 * @returns Array of pending triage predictions.
 */
export async function getPendingTriageIssues(): Promise<TriagePrediction[]> {
  const snapshot = await triageCollection()
    .where("status", "==", "pending")
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data } as TriagePrediction;
  });
}

/**
 * Fetch triage issues filtered by a specific review status.
 * @param status - The review status to filter by.
 * @returns Array of triage predictions matching the status.
 */
export async function getTriageIssuesByStatus(
  status: TriageReviewStatus,
): Promise<TriagePrediction[]> {
  const snapshot = await triageCollection()
    .where("status", "==", status)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data } as TriagePrediction;
  });
}

/**
 * Fetch all triage issues regardless of status.
 * @returns Array of all triage predictions.
 */
export async function getAllTriageIssues(): Promise<TriagePrediction[]> {
  const snapshot = await triageCollection().orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data } as TriagePrediction;
  });
}

/**
 * Fetch a single triage issue by its GitHub issue number.
 * @param issueNumber - The GitHub issue number to look up.
 * @returns The triage prediction or null if not found.
 */
export async function getTriageIssueByIssueNumber(
  issueNumber: number,
): Promise<TriagePrediction | null> {
  const snapshot = await triageCollection()
    .where("issueNumber", "==", issueNumber)
    .limit(1)
    .get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  const data = doc.data();
  return { id: doc.id, ...data } as TriagePrediction;
}

/**
 * Insert or update a triage prediction for an issue.
 * @param issueNumber - The GitHub issue number.
 * @param issueTitle - The issue title.
 * @param issueUrl - The issue HTML URL.
 * @param prediction - The AI prediction to store.
 * @param existingLabels - Labels already on the GitHub issue.
 * @param createdAtGitHub - The original GitHub creation date.
 * @returns The Firestore document ID.
 */
export async function upsertTriagePrediction(
  issueNumber: number,
  issueTitle: string,
  issueUrl: string,
  prediction: AIPrediction,
  existingLabels?: string[],
  createdAtGitHub?: string,
): Promise<string> {
  const existing = await getTriageIssueByIssueNumber(issueNumber);
  const data: Record<
    string,
    string | number | boolean | AIPrediction | string[] | undefined
  > = {
    issueNumber,
    issueTitle,
    issueUrl,
    prediction,
    status: "pending" as TriageReviewStatus,
    updatedAt: new Date().toISOString(),
  };
  if (existingLabels) {
    data.existingLabels = existingLabels;
  }

  if (existing) {
    await triageCollection().doc(existing.id).update(data);
    return existing.id;
  }

  const docRef = await triageCollection().add({
    ...data,
    createdAt: createdAtGitHub || new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Mark a triage prediction as accepted by a reviewer.
 * @param id - The Firestore document ID.
 * @param reviewer - The reviewer's username.
 * @returns Resolves when the update is complete.
 */
export async function acceptTriagePrediction(
  id: string,
  reviewer: string,
): Promise<void> {
  await triageCollection().doc(id).update({
    status: "accepted",
    reviewer,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Update a triage prediction with reviewer corrections.
 * @param id - The Firestore document ID.
 * @param reviewer - The reviewer's username.
 * @param corrections - Array of field corrections made by the reviewer.
 * @returns Resolves when the update is complete.
 */
export async function editTriagePrediction(
  id: string,
  reviewer: string,
  corrections: TriageCorrection[],
): Promise<void> {
  await triageCollection().doc(id).update({
    status: "edited",
    reviewer,
    corrections,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Mark a triage prediction as rejected with optional corrections.
 * @param id - The Firestore document ID.
 * @param reviewer - The reviewer's username.
 * @param corrections - Array of field corrections made by the reviewer.
 * @returns Resolves when the update is complete.
 */
export async function rejectTriagePrediction(
  id: string,
  reviewer: string,
  corrections: TriageCorrection[],
): Promise<void> {
  await triageCollection().doc(id).update({
    status: "rejected",
    reviewer,
    corrections,
    reviewedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Compute triage statistics: totals, acceptance rate, etc.
 * @returns Aggregated triage statistics.
 */
export async function getTriageStats(): Promise<TriageStats> {
  const all = await getAllTriageIssues();
  const total = all.length;
  const accepted = all.filter((i) => i.status === "accepted").length;
  const edited = all.filter((i) => i.status === "edited").length;
  const rejected = all.filter((i) => i.status === "rejected").length;
  const pending = all.filter((i) => i.status === "pending").length;
  const reviewed = accepted + edited + rejected;
  const accuracyRate =
    reviewed > 0 ? Math.round((accepted / reviewed) * 100) : 0;

  return {
    totalPredicted: total,
    accepted,
    edited,
    rejected,
    pending,
    accuracyRate,
  };
}

/**
 * Store reviewer feedback for a triage prediction.
 * @param issueNumber - The GitHub issue number.
 * @param issueId - The Firestore document ID of the triage prediction.
 * @param predictionAccuracy - Accuracy score (0-100).
 * @param reviewStatus - The review action taken.
 * @param reviewer - The reviewer's username.
 * @param changes - Array of corrections made.
 * @param reviewerNotes - Optional notes from the reviewer.
 * @returns The feedback document ID.
 */
export async function storeTriageFeedback(
  issueNumber: number,
  issueId: string,
  predictionAccuracy: number,
  reviewStatus: TriageReviewStatus,
  reviewer: string,
  changes: TriageCorrection[],
  reviewerNotes?: string,
): Promise<string> {
  const docRef = await feedbackCollection().add({
    issueId,
    issueNumber,
    predictionAccuracy,
    reviewStatus,
    reviewer,
    changes,
    reviewerNotes: reviewerNotes || "",
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

/**
 * Fetch all feedback entries for a specific issue.
 * @param issueNumber - The GitHub issue number.
 * @returns Array of feedback entries for the issue.
 */
export async function getTriageFeedbackByIssue(
  issueNumber: number,
): Promise<TriageFeedback[]> {
  const snapshot = await feedbackCollection()
    .where("issueNumber", "==", issueNumber)
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return { id: doc.id, ...data } as TriageFeedback;
  });
}
