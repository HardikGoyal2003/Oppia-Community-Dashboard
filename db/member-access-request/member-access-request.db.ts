import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import {
  normalizeMemberAccessRequestDocument,
  serializeMemberAccessRequest,
} from "@/db/member-access-request/member-access-request.mapper";
import {
  MemberAccessDecision,
  MemberAccessRequestModel,
} from "./member-access-request.types";
import type { ContributionPlatform } from "@/lib/auth/auth.types";

const db = getAdminFirestore();

/**
 * Error raised when a duplicate pending member-access request already exists.
 */
export class PendingMemberAccessRequestError extends Error {
  request: MemberAccessRequestModel;

  constructor(request: MemberAccessRequestModel) {
    super("A pending member access request already exists.");
    this.name = "PendingMemberAccessRequestError";
    this.request = request;
  }
}

/**
 * Retrieves all pending member-access requests across platforms.
 *
 * @returns The pending member-access requests sorted by creation time descending.
 */
export async function getPendingMemberAccessRequests(): Promise<
  MemberAccessRequestModel[]
> {
  return getPendingMemberAccessRequestsByPlatform();
}

/**
 * Retrieves pending member-access requests, optionally scoped to one platform.
 *
 * @param platform The optional contribution platform filter.
 * @returns The pending member-access requests sorted by creation time descending.
 */
export async function getPendingMemberAccessRequestsByPlatform(
  platform?: ContributionPlatform,
): Promise<MemberAccessRequestModel[]> {
  let query: FirebaseFirestore.Query = db
    .collection(DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION)
    .where("status", "==", "PENDING");

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snapshot = await query.orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) =>
    normalizeMemberAccessRequestDocument(doc.data()),
  );
}

/**
 * Creates a new pending member-access request if one does not already exist.
 *
 * @param request The member-access request payload to submit.
 * @returns A promise that resolves when the request has been persisted.
 */
export async function submitMemberAccessRequest(
  request: Omit<MemberAccessRequestModel, "createdAt" | "status">,
): Promise<void> {
  const collectionRef = db.collection(
    DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION,
  );
  const pendingQuery = collectionRef
    .where("email", "==", request.email)
    .where("status", "==", "PENDING");
  const newRequestRef = collectionRef.doc();

  await db.runTransaction(async (tx) => {
    const existingPending = await tx.get(pendingQuery);

    if (!existingPending.empty) {
      const pendingRequest = normalizeMemberAccessRequestDocument(
        existingPending.docs[0].data(),
      );

      throw new PendingMemberAccessRequestError(pendingRequest);
    }

    tx.set(
      newRequestRef,
      serializeMemberAccessRequest({
        ...request,
        status: "PENDING",
        createdAt: new Date(),
      }),
    );
  });
}

/**
 * Resolves the pending member-access request for an email address.
 *
 * @param email The email address that owns the pending request.
 * @param decision The resolution decision to apply.
 * @returns The normalized request that was resolved.
 */
export async function resolveMemberAccessRequest(
  email: string,
  decision: MemberAccessDecision,
): Promise<MemberAccessRequestModel> {
  const collectionRef = db.collection(
    DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION,
  );
  const pendingQuery = collectionRef
    .where("email", "==", email)
    .where("status", "==", "PENDING")
    .limit(1);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(pendingQuery);

    if (snapshot.empty) {
      throw new Error("Member access request not found.");
    }

    const doc = snapshot.docs[0];
    const request = normalizeMemberAccessRequestDocument(doc.data());

    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    tx.set(
      doc.ref,
      serializeMemberAccessRequest({
        ...request,
        status,
      }),
      { merge: false },
    );

    return request;
  });
}
