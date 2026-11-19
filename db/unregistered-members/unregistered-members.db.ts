import { Timestamp } from "firebase-admin/firestore";
import { DB_PATHS } from "@/db/db-paths";
import {
  FIRESTORE_WRITE_BATCH_SIZE,
  chunkValues,
} from "@/db/utils/batch.utils";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";
import type {
  UnregisteredMemberRecord,
  UnregisteredMemberResolution,
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

/** A resolution change applied to an existing document. */
export type UnregisteredMemberResolutionWrite = {
  id: string;
  resolution: UnregisteredMemberResolution;
  resolvedAt: Date;
};

/** Changes produced by one roster reconciliation run. */
export type UnregisteredMemberChanges = {
  upserts: UnregisteredMemberWrite[];
  resolutions: UnregisteredMemberResolutionWrite[];
};

type PendingWrite =
  | {
      kind: "SET";
      ref: FirebaseFirestore.DocumentReference<FirestoreUnregisteredMember>;
      value: FirestoreUnregisteredMember;
    }
  | {
      kind: "UPDATE";
      ref: FirebaseFirestore.DocumentReference<FirestoreUnregisteredMember>;
      value: FirebaseFirestore.UpdateData<FirestoreUnregisteredMember>;
    };

/**
 * Retrieves every roster-gap document, including resolved ones.
 *
 * @returns All stored roster-gap records.
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
 * Retrieves only the currently open roster gaps.
 *
 * @returns Open records sorted by team key, then first-detected time.
 */
export async function getOpenUnregisteredMembers(): Promise<
  UnregisteredMemberRecord[]
> {
  const snapshot = await unregisteredMembersCollection
    .where("state", "==", "OPEN")
    .get();

  return snapshot.docs
    .map((doc) => normalizeUnregisteredMemberRecord(doc.id, doc.data()))
    .sort((left, right) => {
      if (left.teamKey !== right.teamKey) {
        return left.teamKey.localeCompare(right.teamKey);
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });
}

/**
 * Applies roster-gap upserts and resolutions in Firestore batches.
 *
 * Resolution writes are partial updates, so they never change the stored
 * `schemaVersion`; serialization of full documents remains the mapper's job.
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
    ...changes.resolutions.map((resolution) => ({
      kind: "UPDATE" as const,
      ref: unregisteredMembersCollection.doc(resolution.id),
      value: {
        state: "RESOLVED" as const,
        resolution: resolution.resolution,
        resolvedAt: Timestamp.fromDate(resolution.resolvedAt),
      },
    })),
  ];

  for (const chunk of chunkValues(writes, FIRESTORE_WRITE_BATCH_SIZE)) {
    const batch = db.batch();

    for (const write of chunk) {
      if (write.kind === "SET") {
        batch.set(write.ref, write.value);
      } else {
        batch.update(write.ref, write.value);
      }
    }

    await batch.commit();
  }
}
