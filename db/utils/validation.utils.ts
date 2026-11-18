import { DbValidationError } from "@/db/db.errors";

type RawValue = FirebaseFirestore.DocumentData[string];

/**
 * Asserts that a raw value is a non-empty, trimmed string.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @param message Optional custom validation message.
 * @returns Nothing. Throws when the value is not a non-empty string.
 */
export function assertNonEmptyString(
  field: string,
  value: RawValue,
  message = `${field} must be a non-empty string.`,
): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new DbValidationError(field, message);
  }
}

/**
 * Asserts that a raw value is a finite number.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @param message Optional custom validation message.
 * @returns Nothing. Throws when the value is not a finite number.
 */
export function assertFiniteNumber(
  field: string,
  value: RawValue,
  message = `${field} must be a finite number.`,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DbValidationError(field, message);
  }
}

/**
 * Asserts that a raw value is a non-negative finite number.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @param message Optional custom validation message.
 * @returns Nothing. Throws when the value is not a non-negative finite number.
 */
export function assertNonNegativeNumber(
  field: string,
  value: RawValue,
  message = `${field} must be a non-negative number.`,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DbValidationError(field, message);
  }
}

/**
 * Asserts that a raw value is a valid IST-normalized `YYYY-MM-DD` date key.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @param message Optional custom validation message.
 * @returns Nothing. Throws when the value is not a valid calendar date key.
 */
export function assertDateKey(
  field: string,
  value: RawValue,
  message = `${field} must be a YYYY-MM-DD date key.`,
): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DbValidationError(field, message);
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new DbValidationError(field, message);
  }
}

/**
 * Asserts that a raw value is a valid `YYYY-MM` month key.
 *
 * @param field The field name being validated.
 * @param value The raw value.
 * @param message Optional custom validation message.
 * @returns Nothing. Throws when the value is not a valid month key.
 */
export function assertMonthKey(
  field: string,
  value: RawValue,
  message = `${field} must be a YYYY-MM key.`,
): asserts value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) {
    throw new DbValidationError(field, message);
  }

  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) {
    throw new DbValidationError(field, message);
  }
}
