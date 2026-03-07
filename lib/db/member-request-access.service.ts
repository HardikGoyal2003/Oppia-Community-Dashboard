import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import {
  FirestoreMemberAccessRequest,
  normalizeMemberAccessRequest,
  serializeMemberAccessRequest,
} from "@/lib/utils/member-access-request.utils";

const MEMBER_ACCESS_REQUESTS_COLLECTION = "memberAccessRequests";
const MEMBER_ACCESS_REQUESTS_DOC_ID = "requests";

const db = getAdminFirestore();

export interface MemberAccessRequestModel {
  email: string;
  team: string;
  role: string;
  note: string;
  username: string;
  createdAt: Date;
}

export interface MemberAccessRequestsModel {
  pending: MemberAccessRequestModel[];
  responded: MemberAccessRequestModel[];
}

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
    pending?: FirestoreMemberAccessRequest[];
    responded?: FirestoreMemberAccessRequest[];
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
          pending?: FirestoreMemberAccessRequest[];
          responded?: FirestoreMemberAccessRequest[];
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
