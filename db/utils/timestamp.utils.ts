import { Timestamp } from "firebase-admin/firestore";

/**
 * Normalizes a required Firestore timestamp-like value into a Date instance.
 *
 * @param value The timestamp-like value to normalize.
 * @returns The normalized Date instance.
 */
export function normalizeTimestamp(value: Date | Timestamp): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  throw new Error("Expected Firestore timestamp value.");
}
