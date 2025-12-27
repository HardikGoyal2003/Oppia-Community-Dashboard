import { db } from "@/firebaseConfig";
import { Issue } from "../dashboard.types";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";

export async function getAllArchivedIssuesFromDB(): Promise<Issue[]> {
  const querySnapshot = await getDocs(collection(db, "archivedIssues"));
  let archivedIssues: Issue[] = [];
  querySnapshot.forEach((doc) => {
    archivedIssues.push(doc.data() as Issue);
  });

  return archivedIssues;
}

export async function addArchivedIssueToDB(issue: Issue): Promise<void> {
  try {
    await setDoc(doc(db, "archivedIssues", `${issue.issueNumber}`), {
      issueNumber: issue.issueNumber,
      issueUrl: issue.issueUrl,
      issueTitle: issue.issueTitle,
      isArchived: true,
      lastCommentCreatedAt: issue.lastCommentCreatedAt,
      linkedProject: issue.linkedProject,
    });
    console.log("Document written with ID: ", issue.issueNumber);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

export async function removeArchivedIssueFromDB(issueNumber: number): Promise<void> {
  try {
    await deleteDoc(doc(db, "archivedIssues", `${issueNumber}`));
    console.log("Document successfully deleted!");
  } catch (e) {
    console.error("Error removing document: ", e);
  }
}

