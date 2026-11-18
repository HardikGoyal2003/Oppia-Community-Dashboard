import { randomUUID } from "crypto";
import { Timestamp } from "firebase-admin/firestore";
import { DB_PATHS } from "@/db/db-paths";
import {
  SCHEMA_KEYS,
  getCurrentSchemaVersion,
} from "@/db/schema/schema-version";
import { getAdminFirestore } from "@/lib/firebase/firebase-admin";

/**
 * Raised when another process already owns the review-analytics lease.
 */
export class ReviewAnalyticsLockBusyError extends Error {
  constructor() {
    super(
      "Review cycle analytics are already being updated by another job. Try again shortly.",
    );
    this.name = "ReviewAnalyticsLockBusyError";
  }
}

/**
 * Lease duration for a single review-analytics mutation.
 *
 * The lock is renewed while work is running, so this is only the fallback
 * window for a process that dies without releasing it.
 */
const LOCK_TTL_MS = 10 * 60 * 1000;

/** Renew at half the lease duration so transient retries cannot expire it. */
const LOCK_RENEWAL_MS = LOCK_TTL_MS / 2;

const db = getAdminFirestore();
const lockRef = db
  .collection(DB_PATHS.REVIEW_ANALYTICS_LOCKS.COLLECTION)
  .doc(DB_PATHS.REVIEW_ANALYTICS_LOCKS.LOCK_DOC);

type LockState = {
  ownerId: string;
  expiresAtMs: number;
};

/**
 * Parses a stored lease document, treating malformed data as absent.
 *
 * @param data Raw Firestore document data.
 * @returns The parsed lease state, or null when it cannot be trusted.
 */
function parseLockState(
  data: FirebaseFirestore.DocumentData | undefined,
): LockState | null {
  if (!data || typeof data.ownerId !== "string") return null;
  if (!(data.expiresAt instanceof Timestamp)) return null;

  return {
    ownerId: data.ownerId,
    expiresAtMs: data.expiresAt.toDate().getTime(),
  };
}

/**
 * Acquires the singleton review-analytics lease.
 *
 * The transaction makes acquisition atomic: concurrent callers either see no
 * lease and one of them wins, or they see the winner's lease and back off.
 *
 * @returns The owner token used to renew and release the lease.
 */
async function acquireReviewAnalyticsLock(): Promise<string> {
  const ownerId = randomUUID();
  const now = Date.now();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(lockRef);
    const existing = parseLockState(snapshot.data());

    if (existing && existing.expiresAtMs > now) {
      throw new ReviewAnalyticsLockBusyError();
    }

    transaction.set(lockRef, {
      ownerId,
      acquiredAt: Timestamp.fromMillis(now),
      expiresAt: Timestamp.fromMillis(now + LOCK_TTL_MS),
      schemaVersion: getCurrentSchemaVersion(
        SCHEMA_KEYS.REVIEW_ANALYTICS_LOCKS,
      ),
    });
  });

  return ownerId;
}

/**
 * Extends the lease while its owner is still working.
 *
 * Renewal failures are logged but not thrown; the next scheduled renewal or
 * the TTL handles a transient Firestore error.
 *
 * @param ownerId The lease owner token.
 * @returns Nothing.
 */
async function renewReviewAnalyticsLock(ownerId: string): Promise<void> {
  const expiresAt = Timestamp.fromMillis(Date.now() + LOCK_TTL_MS);

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(lockRef);
      const existing = parseLockState(snapshot.data());

      if (!existing || existing.ownerId !== ownerId) return;

      transaction.update(lockRef, { expiresAt });
    });
  } catch (error) {
    console.error("Failed to renew review analytics lock", error);
  }
}

/**
 * Releases the lease only if this caller still owns it.
 *
 * @param ownerId The lease owner token.
 * @returns Nothing.
 */
async function releaseReviewAnalyticsLock(ownerId: string): Promise<void> {
  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(lockRef);
      const existing = parseLockState(snapshot.data());

      if (!existing || existing.ownerId !== ownerId) return;

      transaction.delete(lockRef);
    });
  } catch (error) {
    console.error("Failed to release review analytics lock", error);
  }
}

/**
 * Runs a review-analytics mutation while holding an exclusive Firestore lease.
 *
 * Every path that writes review cycles or derived analytics must use this
 * helper so concurrent cron/data-job runs cannot double-count contributions or
 * overwrite each other's snapshot updates.
 *
 * @param operation The mutation to run under the lease.
 * @returns The operation result.
 */
export async function withReviewAnalyticsLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const ownerId = await acquireReviewAnalyticsLock();
  const renewal = setInterval(() => {
    void renewReviewAnalyticsLock(ownerId);
  }, LOCK_RENEWAL_MS);

  try {
    return await operation();
  } finally {
    clearInterval(renewal);
    await releaseReviewAnalyticsLock(ownerId);
  }
}
