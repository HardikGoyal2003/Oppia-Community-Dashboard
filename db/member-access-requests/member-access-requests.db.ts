import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import { DB_PATHS } from "@/db/db-paths";
import {
  DbAuthorizationError,
  DbInvalidStateError,
  DbValidationError,
  PendingMemberAccessRequestError,
} from "@/db/db.errors";
import { chunkValues } from "@/db/utils/batch.utils";
import {
  getRequiredDocumentSnapshot,
  getRequiredTransactionDocumentSnapshot,
} from "@/db/utils/document.utils";
import { assertNonEmptyId } from "@/db/utils/validation.utils";
import {
  appendUserNotificationInTransaction,
  updateUserRoleAndTeamWithNotificationInTransaction,
} from "@/db/users/users.db";
import { isAssignableUserRole } from "@/lib/auth/roles";
import {
  type FirestoreMemberAccessRequest,
  assertMemberAccessRequestModel,
  normalizeMemberAccessRequestDocument,
  normalizeMemberAccessRequestRecord,
  serializeMemberAccessRequest,
} from "@/db/member-access-requests/member-access-requests.mapper";
import {
  MemberAccessDecision,
  MemberAccessRequestModel,
  MemberAccessRequestRecord,
} from "./member-access-requests.types";
import type { ContributionPlatform, UserRole } from "@/lib/auth/auth.types";

const ADMIN_MANAGEABLE_REQUEST_ROLES: readonly string[] = [
  "TEAM_LEAD",
  "ADMIN",
];
const TEAM_LEAD_MANAGEABLE_REQUEST_ROLES: readonly string[] = [
  "TEAM_MEMBER",
  "LEAD_TRAINEE",
];

/** Actor context required to authorize member-access request resolution. */
export type ResolveMemberAccessRequestActor = {
  role: UserRole;
  team: string | null;
  platform: ContributionPlatform | null;
};

const db = getAdminFirestore();
const memberAccessRequestsCollection = db.collection(
  DB_PATHS.MEMBER_ACCESS_REQUESTS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreMemberAccessRequest>;

/**
 * Retrieves pending member-access requests filtered by platform, roles, and team.
 *
 * @param platform The optional contribution platform filter.
 * @param roles The role values to include. When provided, only requests matching
 *              one of these roles are returned.
 * @param team The optional team key filter. When provided, only requests for
 *             this team are returned.
 * @returns The pending member-access requests sorted by creation time descending.
 * @firestore-index memberAccessRequests status,createdAt
 * @firestore-index memberAccessRequests status,platform,createdAt
 * @firestore-index memberAccessRequests status,role,createdAt
 * @firestore-index memberAccessRequests status,team,createdAt
 * @firestore-index memberAccessRequests status,platform,role,createdAt
 * @firestore-index memberAccessRequests status,platform,team,createdAt
 * @firestore-index memberAccessRequests status,role,team,createdAt
 * @firestore-index memberAccessRequests platform,role,status,team,createdAt
 */
export async function getPendingMemberAccessRequestsByPlatformAndRoles(
  platform?: ContributionPlatform,
  roles?: string[],
  team?: string,
): Promise<MemberAccessRequestRecord[]> {
  const buildQuery = (
    roleChunk?: string[],
  ): FirebaseFirestore.Query<FirestoreMemberAccessRequest> => {
    let query: FirebaseFirestore.Query<FirestoreMemberAccessRequest> =
      memberAccessRequestsCollection.where("status", "==", "PENDING");

    if (platform) {
      query = query.where("platform", "==", platform);
    }

    if (roleChunk && roleChunk.length > 0) {
      query = query.where("role", "in", roleChunk);
    }

    if (team) {
      query = query.where("team", "==", team);
    }

    return query.orderBy("createdAt", "desc");
  };

  const roleChunks =
    roles && roles.length > 0 ? chunkValues(roles, 30) : [undefined];

  const snapshots = await Promise.all(
    roleChunks.map((roleChunk) => buildQuery(roleChunk).get()),
  );

  const recordsById = new Map<string, MemberAccessRequestRecord>();

  for (const snapshot of snapshots) {
    for (const doc of snapshot.docs) {
      if (!recordsById.has(doc.id)) {
        recordsById.set(
          doc.id,
          normalizeMemberAccessRequestRecord(doc.id, doc.data()),
        );
      }
    }
  }

  return Array.from(recordsById.values()).sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
  );
}

/**
 * Creates a new pending member-access request if one does not already exist.
 *
 * @param request The member-access request payload to submit.
 * @returns A promise that resolves when the request has been persisted.
 */
export async function submitMemberAccessRequest(
  request: Omit<
    MemberAccessRequestModel,
    "createdAt" | "status" | "schemaVersion"
  >,
): Promise<void> {
  const memberAccessRequest: Omit<MemberAccessRequestModel, "schemaVersion"> = {
    ...request,
    status: "PENDING",
    createdAt: new Date(),
  };

  assertMemberAccessRequestModel(memberAccessRequest);

  const collectionRef = memberAccessRequestsCollection;
  const pendingQuery = collectionRef
    .where("userId", "==", request.userId)
    .where("status", "==", "PENDING");
  const newRequestRef = collectionRef.doc();

  await memberAccessRequestsCollection.firestore.runTransaction(async (tx) => {
    const existingPending = await tx.get(pendingQuery);

    if (!existingPending.empty) {
      const pendingRequest = normalizeMemberAccessRequestDocument(
        existingPending.docs[0].data(),
      );

      throw new PendingMemberAccessRequestError(pendingRequest);
    }

    tx.set(newRequestRef, serializeMemberAccessRequest(memberAccessRequest));
  });
}

/**
 * Retrieves a member-access request by document id without modifying it.
 *
 * @param requestId The member-access request document id.
 * @returns The normalized request record.
 * @throws {DbNotFoundError} When the request document does not exist.
 */
export async function getMemberAccessRequestById(
  requestId: string,
): Promise<MemberAccessRequestRecord> {
  assertNonEmptyId("requestId", requestId);
  const requestRef = memberAccessRequestsCollection.doc(requestId);
  const snapshot = await getRequiredDocumentSnapshot(
    "Member access request",
    requestRef,
  );

  return normalizeMemberAccessRequestRecord(snapshot.id, snapshot.data()!);
}

/**
 * Asserts that an actor may resolve a member-access request.
 *
 * @param actor The actor attempting to resolve the request.
 * @param request The pending request to resolve.
 * @returns Nothing. Throws when the actor is not authorized.
 */
function assertCanResolveMemberAccessRequest(
  actor: ResolveMemberAccessRequestActor,
  request: MemberAccessRequestRecord,
): void {
  if (actor.role === "ADMIN" || actor.role === "SUPER_ADMIN") {
    if (!ADMIN_MANAGEABLE_REQUEST_ROLES.includes(request.role)) {
      throw new DbAuthorizationError(
        "You do not have permission to resolve requests for this role.",
      );
    }
    return;
  }

  if (actor.role === "TEAM_LEAD" || actor.role === "LEAD_TRAINEE") {
    if (!TEAM_LEAD_MANAGEABLE_REQUEST_ROLES.includes(request.role)) {
      throw new DbAuthorizationError(
        "You do not have permission to resolve requests for this role.",
      );
    }

    if (!actor.team || request.team !== actor.team) {
      throw new DbAuthorizationError(
        "You do not have permission to resolve requests for another team.",
      );
    }

    if (!actor.platform || request.platform !== actor.platform) {
      throw new DbAuthorizationError(
        "You do not have permission to resolve requests for another platform.",
      );
    }

    return;
  }

  throw new DbAuthorizationError();
}

/**
 * Resolves the pending member-access request for a request id.
 *
 * The request status, user role/team, and notification are written in one
 * transaction so an authorized decision either commits fully or not at all.
 * Authorization is re-checked inside the transaction.
 *
 * @param requestId The member-access request document id.
 * @param decision The resolution decision to apply.
 * @param notificationMessage The notification to append to the requester.
 * @param actor The actor resolving the request.
 * @returns The normalized request record that was resolved.
 */
export async function resolveMemberAccessRequest(
  requestId: string,
  decision: MemberAccessDecision,
  notificationMessage: string,
  actor: ResolveMemberAccessRequestActor,
): Promise<MemberAccessRequestRecord> {
  assertNonEmptyId("requestId", requestId);
  const requestRef = memberAccessRequestsCollection.doc(requestId);

  return memberAccessRequestsCollection.firestore.runTransaction(async (tx) => {
    const snapshot = await getRequiredTransactionDocumentSnapshot(
      tx,
      "Member access request",
      requestRef,
    );

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

    assertCanResolveMemberAccessRequest(actor, request);

    if (decision === "ACCEPT") {
      if (!isAssignableUserRole(request.role)) {
        throw new DbValidationError("role", "Invalid role in request.");
      }

      await updateUserRoleAndTeamWithNotificationInTransaction(
        tx,
        request.userId,
        request.role,
        request.team,
        request.username,
        notificationMessage,
      );
    } else {
      await appendUserNotificationInTransaction(
        tx,
        request.userId,
        notificationMessage,
      );
    }

    const status = decision === "ACCEPT" ? "ACCEPTED" : "REJECTED";

    tx.update(requestRef, { status });

    return {
      ...request,
      status,
    };
  });
}
