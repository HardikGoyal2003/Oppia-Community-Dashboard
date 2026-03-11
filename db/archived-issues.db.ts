import { db } from "@/lib/firebase/firebase.client";
import { Issue } from "@/features/dashboard/dashboard.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";

const ARCHIVED_ISSUES_COLLECTION = "archivedIssues";

type ArchivedIssueDoc = Issue & {
  platform: ContributionPlatform;
};

function getArchivedIssueDocId(
  platform: ContributionPlatform,
  issueNumber: number
): string {
  return `${platform}_${issueNumber}`;
}

export async function getArchivedIssues(
  platform: ContributionPlatform
): Promise<ArchivedIssueDoc[]> {
  const q = query(
    collection(db, ARCHIVED_ISSUES_COLLECTION),
    where("platform", "==", platform)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(
    (docSnap) => docSnap.data() as ArchivedIssueDoc
  );
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
      ...issue,
      platform,
      isArchived: true,
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
