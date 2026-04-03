import { DbNotFoundError } from "@/db/db.errors";

/**
 * Loads a document snapshot and guarantees that the referenced document exists.
 *
 * @param resource The resource name used for not-found errors.
 * @param docRef The document reference to load.
 * @returns The existing document snapshot.
 * @throws {DbNotFoundError} When the referenced document does not exist.
 */
export async function getRequiredDocumentSnapshot<
  T = FirebaseFirestore.DocumentData,
>(
  resource: string,
  docRef: FirebaseFirestore.DocumentReference<T>,
): Promise<FirebaseFirestore.DocumentSnapshot<T>> {
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    throw new DbNotFoundError(resource);
  }

  return snapshot;
}

/**
 * Resolves a document reference and guarantees that the referenced document exists.
 *
 * @param resource The resource name used for not-found errors.
 * @param docRef The document reference to validate.
 * @returns The same document reference when the document exists.
 * @throws {DbNotFoundError} When the referenced document does not exist.
 */
export async function getRequiredDocumentRef<
  T = FirebaseFirestore.DocumentData,
>(
  resource: string,
  docRef: FirebaseFirestore.DocumentReference<T>,
): Promise<FirebaseFirestore.DocumentReference<T>> {
  await getRequiredDocumentSnapshot(resource, docRef);
  return docRef;
}

/**
 * Loads a document snapshot through a transaction and guarantees that the referenced document exists.
 *
 * @param tx The active Firestore transaction.
 * @param resource The resource name used for not-found errors.
 * @param docRef The document reference to load.
 * @returns The existing document snapshot.
 * @throws {DbNotFoundError} When the referenced document does not exist.
 */
export async function getRequiredTransactionDocumentSnapshot<
  T = FirebaseFirestore.DocumentData,
>(
  tx: FirebaseFirestore.Transaction,
  resource: string,
  docRef: FirebaseFirestore.DocumentReference<T>,
): Promise<FirebaseFirestore.DocumentSnapshot<T>> {
  const snapshot = await tx.get(docRef);

  if (!snapshot.exists) {
    throw new DbNotFoundError(resource);
  }

  return snapshot;
}
