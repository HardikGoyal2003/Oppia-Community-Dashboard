import { DbNotFoundError } from "@/db/db.errors";

/**
 * Determines whether a Firestore error indicates a missing document.
 *
 * @param error The thrown Firestore error candidate.
 * @returns True when the error represents a not-found document.
 */
function isDocumentNotFoundError(error: object): boolean {
  return "code" in error && error.code === 5;
}

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
 * Updates a document and maps a missing-document failure to a typed not-found error.
 *
 * @param resource The resource name used for not-found errors.
 * @param docRef The document reference to update.
 * @param data The update payload to apply.
 * @returns A promise that resolves when the update completes.
 * @throws {DbNotFoundError} When the referenced document does not exist.
 */
export async function updateRequiredDocument<
  T = FirebaseFirestore.DocumentData,
>(
  resource: string,
  docRef: FirebaseFirestore.DocumentReference<T>,
  data: FirebaseFirestore.UpdateData<T>,
): Promise<void> {
  try {
    await (
      docRef.update as (
        updateData: FirebaseFirestore.UpdateData<T>,
      ) => Promise<FirebaseFirestore.WriteResult>
    )(data);
  } catch (error) {
    if (error && typeof error === "object" && isDocumentNotFoundError(error)) {
      throw new DbNotFoundError(resource);
    }

    throw error;
  }
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
