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
 * Lists everyone currently missing from a team member sheet.
 *
 * When a person registers or leaves the sheet, their document is deleted.
 * Everything stored here therefore still needs follow-up, so no status filter
 * is needed.
 *
 * @returns All stored records, sorted by team key then first-detected time.
 */
export async function getUnregisteredMembers(): Promise<
  UnregisteredMemberRecord[]
> {
  const snapshot = await unregisteredMembersCollection.get();
  const members = snapshot.docs.map((doc) =>
    normalizeUnregisteredMemberRecord(doc.id, doc.data()),
  );

  return members.sort((left, right) => {
    if (left.teamKey !== right.teamKey) {
      return left.teamKey.localeCompare(right.teamKey);
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  });
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
