/**
 * Persisted progress for the resumable review-cycle backfill.
 *
 * The backfill walks forward in small date windows because a full two-month
 * scan cannot finish inside a single serverless invocation. Within a window,
 * PR-level progress is checkpointed so a timeout never repeats work.
 */
export type ReviewCycleBackfillState = {
  /** Inclusive `YYYY-MM-DD` start of the current window. */
  windowStart: string;
  /** Inclusive `YYYY-MM-DD` end of the current window. */
  windowEnd: string;
  /** Inclusive `YYYY-MM-DD` end of the whole backfill. */
  targetEnd: string;
  /** PR numbers already processed inside the current window. */
  processedPrNumbers: number[];
  updatedAt: Date;
};
