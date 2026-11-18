/**
 * Logs an operational DB-layer error in a consistent format.
 *
 * @param message The human-readable error context.
 * @param error The thrown error or failure reason.
 * @returns Nothing.
 */
export function logDbError(
  message: string,
  error:
    | object
    | string
    | number
    | boolean
    | bigint
    | symbol
    | null
    | undefined,
): void {
  console.error(`[db] ${message}`, error);
}
