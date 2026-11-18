/**
 * Logs an operational DB-layer error in a consistent format.
 *
 * @param message The human-readable error context.
 * @param error The thrown error or failure reason.
 * @returns Nothing.
 */
export function logDbError<T>(message: string, error: T): void {
  console.error(`[db] ${message}`, error);
}
