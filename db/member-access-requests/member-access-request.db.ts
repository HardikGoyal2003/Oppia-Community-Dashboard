import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import { DbInvalidStateError, DbNotFoundError } from "@/db/db.errors";
import {
  normalizeMemberAccessRequestDocument,
  normalizeMemberAccessRequestRecord,
  serializeMemberAccessRequest,
} from "@/db/member-access-requests/member-access-request.mapper";
import {
  MemberAccessDecision,
  MemberAccessRequestModel,
  MemberAccessRequestRecord,
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
  MemberAccessRequestRecord[]
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
): Promise<MemberAccessRequestRecord[]> {
  let query: FirebaseFirestore.Query = db
    .collection(DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION)
    .where("status", "==", "PENDING");

  if (platform) {
    query = query.where("platform", "==", platform);
  }

  const snapshot = await query.orderBy("createdAt", "desc").get();

  return snapshot.docs.map((doc) =>
    normalizeMemberAccessRequestRecord(doc.id, doc.data()),
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
    .where("userId", "==", request.userId)
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
 * Resolves the pending member-access request for a request id.
 *
 * @param requestId The member-access request document id.
 * @param decision The resolution decision to apply.
 * @returns The normalized request record that was resolved.
 */
export async function resolveMemberAccessRequest(
  requestId: string,
  decision: MemberAccessDecision,
): Promise<MemberAccessRequestRecord> {
  const requestRef = db
    .collection(DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION)
    .doc(requestId);

  return db.runTransaction(async (tx) => {
    const snapshot = await tx.get(requestRef);

    if (!snapshot.exists) {
      throw new DbNotFoundError("Member access request");
    }

    const request = normalizeMemberAccessRequestRecord(
      snapshot.id,
      snapshot.data()!,
    );

    if (request.status !== "PENDING") {
      throw new DbInvalidStateError(
        "Member access request",
        "Member access request is no longer pending.",
      );
    }

    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    tx.set(
      requestRef,
      serializeMemberAccessRequest({
        ...request,
        status,
      }),
      { merge: false },
    );

    return request;
  });
}
