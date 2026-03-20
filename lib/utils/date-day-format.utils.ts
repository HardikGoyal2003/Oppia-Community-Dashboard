export function getOrdinalDay(day: number): string {
  const remainder = day % 10;
  const teen = day % 100;

  if (teen >= 11 && teen <= 13) {
    return `${day}th`;
  }

  if (remainder === 1) {
    return `${day}st`;
  }

  if (remainder === 2) {
    return `${day}nd`;
  }

  if (remainder === 3) {
    return `${day}rd`;
  }

  return `${day}th`;
}