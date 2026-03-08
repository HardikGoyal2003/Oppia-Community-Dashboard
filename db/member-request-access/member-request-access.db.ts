import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  FirestoreMemberAccessRequest,
  normalizeMemberAccessRequest,
  serializeMemberAccessRequest,
} from "@/db/member-request-access/member-access-request.mapper";
import { MemberAccessDecision, MemberAccessRequestModel, MemberAccessRequestsModel } from "./member-request-access.types";

const MEMBER_ACCESS_REQUESTS_COLLECTION = "memberAccessRequests";
const MEMBER_ACCESS_REQUESTS_DOC_ID = "requests";

const db = getAdminFirestore();

export async function getMemberAccessRequests(): Promise<MemberAccessRequestsModel> {
  const ref = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .doc(MEMBER_ACCESS_REQUESTS_DOC_ID);
  const snap = await ref.get();

  if (!snap.exists) {
    return {
      pending: [],
      responded: [],
    };
  }

  const data = snap.data() as {
    pending: FirestoreMemberAccessRequest[];
    responded: FirestoreMemberAccessRequest[];
  };

  return {
    pending: (data.pending ?? []).map(normalizeMemberAccessRequest),
    responded: (data.responded ?? []).map(normalizeMemberAccessRequest),
  };
}

export async function submitMemberAccessRequest(
  request: Omit<MemberAccessRequestModel, "createdAt">
): Promise<void> {
  const ref = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .doc(MEMBER_ACCESS_REQUESTS_DOC_ID);

  await db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    const existing = snap.exists
      ? (snap.data() as {
          pending: FirestoreMemberAccessRequest[];
          responded: FirestoreMemberAccessRequest[];
        })
      : { pending: [], responded: [] };

    const pending = (existing.pending ?? []).map(
      normalizeMemberAccessRequest
    );

    const withoutCurrentEmail = pending.filter(
      item => item.email !== request.email
    );

    const nextPending = [
      ...withoutCurrentEmail,
      {
        ...request,
        createdAt: new Date(),
      },
    ];

    tx.set(
      ref,
      {
        pending: nextPending.map(serializeMemberAccessRequest),
        responded: existing.responded ?? [],
      },
      { merge: true }
    );
  });
}

export async function resolveMemberAccessRequest(
  email: string,
  decision: MemberAccessDecision
): Promise<MemberAccessRequestModel> {
  const ref = db
    .collection(MEMBER_ACCESS_REQUESTS_COLLECTION)
    .doc(MEMBER_ACCESS_REQUESTS_DOC_ID);

  return db.runTransaction(async tx => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      throw new Error("No pending requests found.");
    }

    const data = snap.data() as {
      pending: FirestoreMemberAccessRequest[];
      responded: FirestoreMemberAccessRequest[];
    };

    const pending = (data.pending ?? []).map(
      normalizeMemberAccessRequest
    );
    const responded = (data.responded ?? []).map(
      normalizeMemberAccessRequest
    );

    const request = pending.find(item => item.email === email);

    if (!request) {
      throw new Error("Member access request not found.");
    }

    const nextPending = pending.filter(
      item => item.email !== email
    );

    tx.set(
      ref,
      {
        pending: nextPending.map(serializeMemberAccessRequest),
        responded: [
          ...responded,
          {
            ...request,
            note: decision === "DECLINE"
              ? request.note
              : request.note,
          },
        ].map(serializeMemberAccessRequest),
      },
      { merge: true }
    );

    return request;
  });
}
