import { db } from "@/lib/firebase/firebase.client";
import { Issue } from "@/app/dashboard/dashboard.types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

const ARCHIVED_ISSUES_COLLECTION = "archivedIssues";

export async function getArchivedIssues(): Promise<Issue[]> {
  const snapshot = await getDocs(
    collection(db, ARCHIVED_ISSUES_COLLECTION)
  );

  return snapshot.docs.map(
    (doc) => doc.data() as Issue
  );
}

export async function archiveIssue(issue: Issue): Promise<void> {
  await setDoc(
    doc(db, ARCHIVED_ISSUES_COLLECTION, String(issue.issueNumber)),
    {
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      issueTitle: issue.issueTitle,
      isArchived: true,
      lastCommentCreatedAt: issue.lastCommentCreatedAt,
      linkedProject: issue.linkedProject,
    }
  );
}

export async function unarchiveIssue(issueNumber: number): Promise<void> {
  await deleteDoc(
    doc(db, ARCHIVED_ISSUES_COLLECTION, String(issueNumber))
  );
}
