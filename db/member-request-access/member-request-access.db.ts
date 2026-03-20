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

function getMemberAccessRequestDocId(email: string): string {
  return encodeURIComponent(email.trim().toLowerCase());
}

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

export async function submitMemberAccessRequest(
  request: Omit<MemberAccessRequestModel, "createdAt" | "status">
): Promise<void> {
  const ref = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .doc(getMemberAccessRequestDocId(request.email));

  await ref.set(
    serializeMemberAccessRequest({
      ...request,
      status: "PENDING",
      createdAt: new Date(),
    })
  );
}

export async function resolveMemberAccessRequest(
  email: string,
  decision: MemberAccessDecision
): Promise<MemberAccessRequestModel> {
  const ref = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .doc(getMemberAccessRequestDocId(email));

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new Error("Member access request not found.");
    }

    const request = normalizeMemberAccessRequest(
      snap.data() as FirestoreMemberAccessRequest
    );

    if (request.status !== "PENDING") {
      throw new Error("Member access request is not pending.");
    }

    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    tx.set(
      ref,
      serializeMemberAccessRequest({
        ...request,
        status,
      }),
      { merge: false }
    );

    return request;
  });
}
