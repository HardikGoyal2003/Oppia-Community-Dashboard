import { Timestamp } from "firebase-admin/firestore";

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

export function normalizeOptionalTimestamp(
  value: Date | Timestamp | undefined | null,
): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeTimestamp(value);
}
