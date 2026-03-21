import { Timestamp } from "firebase-admin/firestore";

/**
 * Normalizes a required Firestore timestamp-like value into a Date instance.
 *
 * @param value The timestamp-like value to normalize.
 * @returns The normalized Date instance.
 */
export function normalizeTimestamp(
  value: Date | Timestamp | undefined | null,
): Date {
  if (value instanceof Timestamp) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  throw new Error("Expected Firestore timestamp value.");
}

/**
 * Normalizes an optional Firestore timestamp-like value into a nullable Date.
 *
 * @param value The optional timestamp-like value to normalize.
 * @returns The normalized Date, or null when the field is absent.
 */
export function normalizeOptionalTimestamp(
  value: Date | Timestamp | undefined | null,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeTimestamp(value);
}
