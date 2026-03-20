export function formatDisplayValue(value: string | null): string {
  if (!value) {
    return "-";
  }

  return value.replace(/_/g, " ");
}
