import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";

/**
 * Asserts that a raw DB value is a Firestore Timestamp.
 *
 * @param entity The entity name being validated.
 * @param field The field name being validated.
 * @param value The raw DB value.
 * @returns Nothing. Throws when the value is not a Timestamp.
 */
export function assertTimestamp(
  entity: string,
  field: string,
  value:
    | Timestamp
    | Date
    | object
    | string
    | number
    | boolean
    | null
    | undefined,
): asserts value is Timestamp {
  if (!(value instanceof Timestamp)) {
    throw new DbValidationError(
      field,
      `${entity} ${field} must be a Timestamp.`,
    );
  }
}

/**
 * Asserts that a raw DB value is either null or a Firestore Timestamp.
 *
 * @param entity The entity name being validated.
 * @param field The field name being validated.
 * @param value The raw DB value.
 * @returns Nothing. Throws when the value is neither null nor a Timestamp.
 */
export function assertOptionalTimestamp(
  entity: string,
  field: string,
  value:
    | Timestamp
    | Date
    | object
    | string
    | number
    | boolean
    | null
    | undefined,
): asserts value is Timestamp | null {
  if (value !== null && !(value instanceof Timestamp)) {
    throw new DbValidationError(
      field,
      `${entity} ${field} must be a Timestamp or null.`,
    );
  }
}

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

  throw new DbValidationError(
    "timestamp",
    "Expected Firestore timestamp value.",
  );
}
