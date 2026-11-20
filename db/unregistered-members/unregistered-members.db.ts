import { DB_PATHS } from "@/db/db-paths";
import {
  FIRESTORE_WRITE_BATCH_SIZE,
  chunkValues,
} from "@/db/utils/batch.utils";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type {
  UnregisteredMemberRecord,
  UnregisteredMemberWrite,
} from "@/db/unregistered-members/unregistered-members.types";
import {
  type FirestoreUnregisteredMember,
  normalizeUnregisteredMemberRecord,
  serializeUnregisteredMember,
} from "@/db/unregistered-members/unregistered-members.mapper";

const db = getAdminFirestore();
const unregisteredMembersCollection = db.collection(
  DB_PATHS.UNREGISTERED_MEMBERS.COLLECTION,
) as FirebaseFirestore.CollectionReference<FirestoreUnregisteredMember>;

/** Changes produced by one team member sheet reconciliation run. */
export type UnregisteredMemberChanges = {
  /** Document ids to remove: the person registered or left the sheet. */
  deleteIds: string[];
  upserts: UnregisteredMemberWrite[];
};

type PendingWrite =
  | {
      kind: "SET";
      ref: FirebaseFirestore.DocumentReference<FirestoreUnregisteredMember>;
      value: FirestoreUnregisteredMember;
    }
  | {
      kind: "DELETE";
      ref: FirebaseFirestore.DocumentReference<FirestoreUnregisteredMember>;
    };

/**
 * Retrieves every currently open gap.
 *
 * Every document in this collection is open by construction: resolved gaps
 * are deleted rather than retained as historical records.
 *
 * @returns All stored missing-person records.
 */
export async function getUnregisteredMembers(): Promise<
  UnregisteredMemberRecord[]
> {
  const snapshot = await unregisteredMembersCollection.get();

  return snapshot.docs.map((doc) =>
    normalizeUnregisteredMemberRecord(doc.id, doc.data()),
  );
}

/**
 * Retrieves the currently open gaps in a stable display order.
 *
 * @returns Open records sorted by team key, then first-detected time.
 */
export async function getOpenUnregisteredMembers(): Promise<
  UnregisteredMemberRecord[]
> {
  const members = await getUnregisteredMembers();

  return members.sort((left, right) => {
    if (left.teamKey !== right.teamKey) {
      return left.teamKey.localeCompare(right.teamKey);
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
}

/**
 * Removes documents left behind by the earlier soft-delete version of this
 * model. Safe to call on every run; normally removes nothing.
 *
 * @returns The number of legacy documents removed.
 */
export async function deleteLegacyResolvedUnregisteredMembers(): Promise<number> {
  const snapshot = await unregisteredMembersCollection
    .where("state", "==", "RESOLVED")
    .get();
  const ids = snapshot.docs.map((doc) => doc.id);

  for (const chunk of chunkValues(ids, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = db.batch();

    for (const id of chunk) {
      batch.delete(unregisteredMembersCollection.doc(id));
    }

    await batch.commit();
  }

  return ids.length;
}

/**
 * Applies missing-person upserts and deletions in Firestore batches.
 *
 * @param changes The writes produced by a reconciliation run.
 * @returns A promise that resolves when every batch has been committed.
 */
export async function saveUnregisteredMemberChanges(
  changes: UnregisteredMemberChanges,
): Promise<void> {
  const writes: PendingWrite[] = [
    ...changes.upserts.map((member) => ({
      kind: "SET" as const,
      ref: unregisteredMembersCollection.doc(member.id),
      value: serializeUnregisteredMember(member),
    })),
    ...changes.deleteIds.map((id) => ({
      kind: "DELETE" as const,
      ref: unregisteredMembersCollection.doc(id),
    })),
  ];

  for (const chunk of chunkValues(writes, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = db.batch();

    for (const write of chunk) {
      if (write.kind === "SET") {
        batch.set(write.ref, write.value);
      } else {
        batch.delete(write.ref);
      }
    }

    await batch.commit();
  }
}
