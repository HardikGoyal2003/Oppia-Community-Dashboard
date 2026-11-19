import { Timestamp } from "firebase-admin/firestore";
import { DbValidationError } from "@/db/db.errors";

type FirestoreTimestampLike = {
  toDate: () => Date;
  toMillis: () => number;
};

type RawTimestampValue =
  | Timestamp
  | Date
  | {
      toDate?: () => Date;
      toMillis?: () => number;
    }
  | string
  | number
  | boolean
  | null
  | undefined
  | object;

/**
 * Determines whether a value behaves like a Firestore Timestamp.
 *
 * @param value The raw value to inspect.
 * @returns True when the value exposes valid timestamp conversion methods.
 */
function isFirestoreTimestampLike(
  value: RawTimestampValue,
): value is FirestoreTimestampLike {
  if (value instanceof Timestamp) {
    return true;
  }

  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as {
    toDate?: () => Date;
    toMillis?: () => number;
  };

  if (
    typeof candidate.toDate !== "function" ||
    typeof candidate.toMillis !== "function"
  ) {
    return false;
  }

  const millis = candidate.toMillis();
  return Number.isFinite(millis);
}

/**
 * Converts a timestamp-like value to a validated Date instance.
 *
 * @param value The timestamp-like value to convert.
 * @returns The converted Date, or null when conversion is invalid.
 */
function toValidDate(value: RawTimestampValue): Date | null {
  if (isFirestoreTimestampLike(value)) {
    const date = value.toDate();
    return Number.isFinite(date.getTime()) ? date : null;
  }

  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value.getTime()) : null;
  }

  return null;
}

/**
 * Asserts that a raw DB value is a Firestore Timestamp-like value.
 *
 * @param entity The entity name being validated.
 * @param field The field name being validated.
 * @param value The raw DB value.
 * @returns Nothing. Throws when the value is not a valid timestamp.
 */
export function assertTimestamp(
  entity: string,
  field: string,
  value: RawTimestampValue,
): asserts value is Timestamp {
  if (!isFirestoreTimestampLike(value)) {
    throw new DbValidationError(
      field,
      `${entity} ${field} must be a Timestamp.`,
    );
  }
}

/**
 * Asserts that a raw DB value is nullish or a Firestore Timestamp-like value.
 *
 * @param entity The entity name being validated.
 * @param field The field name being validated.
 * @param value The raw DB value.
 * @returns Nothing. Throws when the value is present but not a valid timestamp.
 */
export function assertOptionalTimestamp(
  entity: string,
  field: string,
  value: RawTimestampValue,
): asserts value is Timestamp | null | undefined {
  if (value == null) {
    return;
  }

  if (!isFirestoreTimestampLike(value)) {
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
export function normalizeTimestamp(value: RawTimestampValue): Date {
  const date = toValidDate(value);

  if (!date) {
    throw new DbValidationError(
      "timestamp",
      "Expected Firestore timestamp value.",
    );
  }

  return date;
}

/**
 * Converts a Date or Firestore Timestamp-like value to a Firestore Timestamp.
 *
 * @param value The date or timestamp-like value.
 * @returns The Firestore Timestamp representation.
 */
export function toFirestoreTimestamp(
  value: Date | FirestoreTimestampLike,
): Timestamp {
  if (value instanceof Timestamp) {
    const millis = value.toMillis();
    if (!Number.isFinite(millis)) {
      throw new DbValidationError(
        "timestamp",
        "Expected Firestore timestamp value.",
      );
    }
    return value;
  }

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new DbValidationError(
        "timestamp",
        "Expected Firestore timestamp value.",
      );
    }

    return Timestamp.fromDate(value);
  }

  const millis = value.toMillis();
  const date = value.toDate();
  if (!Number.isFinite(millis) || !Number.isFinite(date.getTime())) {
    throw new DbValidationError(
      "timestamp",
      "Expected Firestore timestamp value.",
    );
  }

  return Timestamp.fromMillis(millis);
}
