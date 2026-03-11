import { db } from "@/lib/firebase/firebase.client";
import { Issue } from "@/features/dashboard/dashboard.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from "firebase/firestore";

const ARCHIVED_ISSUES_COLLECTION = "archivedIssues";

type ArchivedIssueDoc = Issue & {
  platform?: ContributionPlatform;
};

function getArchivedIssueDocId(
  platform: ContributionPlatform,
  issueNumber: number
): string {
  return `${platform}_${issueNumber}`;
}

export async function getArchivedIssues(
  platform: ContributionPlatform
): Promise<Issue[]> {
  const snapshot = await getDocs(
    collection(db, ARCHIVED_ISSUES_COLLECTION)
  );

  return snapshot.docs
    .map((docSnap) => docSnap.data() as ArchivedIssueDoc)
    .filter((data) => {
      const docPlatform = data.platform ?? "WEB";
      return docPlatform === platform;
    });
}

export async function archiveIssue(
  issue: Issue,
  platform: ContributionPlatform
): Promise<void> {
  await setDoc(
    doc(
      db,
      ARCHIVED_ISSUES_COLLECTION,
      getArchivedIssueDocId(platform, issue.issueNumber)
    ),
    {
      platform,
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      issueTitle: issue.issueTitle,
      isArchived: true,
      lastCommentCreatedAt: issue.lastCommentCreatedAt,
      linkedProject: issue.linkedProject,
    }
  );
}

export async function unarchiveIssue(
  issueNumber: number,
  platform: ContributionPlatform
): Promise<void> {
  await deleteDoc(
    doc(
      db,
      ARCHIVED_ISSUES_COLLECTION,
      getArchivedIssueDocId(platform, issueNumber)
    )
  );
}
