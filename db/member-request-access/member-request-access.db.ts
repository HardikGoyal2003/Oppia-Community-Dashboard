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
import type { ContributionPlatform } from "@/lib/auth/auth.types";

const MEMBER_ACCESS_REQUESTS_COLLECTION = "memberAccessRequests";

const db = getAdminFirestore();

export class PendingMemberAccessRequestError extends Error {
  request: MemberAccessRequestModel;

  constructor(request: MemberAccessRequestModel) {
    super("A pending member access request already exists.");
    this.name = "PendingMemberAccessRequestError";
    this.request = request;
  }
}

export async function getPendingMemberAccessRequests(): Promise<
  MemberAccessRequestModel[]
> {
  return getPendingMemberAccessRequestsByPlatform();
}

export async function getPendingMemberAccessRequestsByPlatform(
  platform?: ContributionPlatform
): Promise<MemberAccessRequestModel[]> {
  let query: FirebaseFirestore.Query = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .where("status", "==", "PENDING");

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snapshot = await query.get();

  return snapshot.docs
    .map(doc =>
      normalizeMemberAccessRequest(
        doc.data() as FirestoreMemberAccessRequest
      )
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
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

    if (!existingPending.empty) {
      const pendingRequest = normalizeMemberAccessRequest(
        existingPending.docs[0].data() as FirestoreMemberAccessRequest
      );

      throw new PendingMemberAccessRequestError(pendingRequest);
    }

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
