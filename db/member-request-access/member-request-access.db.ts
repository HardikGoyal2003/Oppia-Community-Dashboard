import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  FirestoreMemberAccessRequest,
  normalizeMemberAccessRequest,
  serializeMemberAccessRequest,
} from "@/db/member-request-access/member-access-request.mapper";
import {
  MemberAccessDecision,
  MemberAccessRequestModel,
} from "./member-request-access.types";

const MEMBER_ACCESS_REQUESTS_COLLECTION = "memberAccessRequests";

const db = getAdminFirestore();

export async function getMemberAccessRequests(): Promise<
  MemberAccessRequestModel[]
> {
  const snapshot = await db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(doc =>
    normalizeMemberAccessRequest(
      doc.data() as FirestoreMemberAccessRequest
    )
  );
}

export async function getPendingMemberAccessRequests(): Promise<
  MemberAccessRequestModel[]
> {
  const snapshot = await db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .where("status", "==", "PENDING")
    .orderBy("createdAt", "desc")
    .get();

  return snapshot.docs.map(doc =>
    normalizeMemberAccessRequest(
      doc.data() as FirestoreMemberAccessRequest
    )
  );
}

export async function submitMemberAccessRequest(
  request: Omit<MemberAccessRequestModel, "createdAt" | "status">
): Promise<void> {
  const collectionRef = db.collection(MEMBER_ACCESS_REQUESTS_COLLECTION);
  const pendingQuery = collectionRef
    .where("email", "==", request.email)
    .where("status", "==", "PENDING");
  const newRequestRef = collectionRef.doc();

  await db.runTransaction(async tx => {
    const existingPending = await tx.get(pendingQuery);

    existingPending.docs.forEach(doc => {
      tx.delete(doc.ref);
    });

    tx.set(
      newRequestRef,
      serializeMemberAccessRequest({
        ...request,
        status: "PENDING",
        createdAt: new Date(),
      })
    );
  });
}

export async function resolveMemberAccessRequest(
  email: string,
  decision: MemberAccessDecision
): Promise<MemberAccessRequestModel> {
  const collectionRef = db.collection(MEMBER_ACCESS_REQUESTS_COLLECTION);
  const pendingQuery = collectionRef
    .where("email", "==", email)
    .where("status", "==", "PENDING")
    .limit(1);

  return db.runTransaction(async tx => {
    const snapshot = await tx.get(pendingQuery);

    if (snapshot.empty) {
      throw new Error("Member access request not found.");
    }

    const doc = snapshot.docs[0];
    const request = normalizeMemberAccessRequest(
      doc.data() as FirestoreMemberAccessRequest
    );

    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    tx.set(
      doc.ref,
      serializeMemberAccessRequest({
        ...request,
        status,
      }),
      { merge: false }
    );

    return request;
  });
}
