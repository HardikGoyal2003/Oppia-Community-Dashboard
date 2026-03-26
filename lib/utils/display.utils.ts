/**
 * Formats a stored enum-like value for display.
 *
 * @param value The raw value to format.
 * @returns A user-friendly display value, or `-` when unset.
 */
export function formatDisplayValue(value: string | null): string {
  if (!value) {
    return "-";
  }

  return value.replace(/_/g, " ");
}
