/** Default maximum number of writes committed per Firestore batch. */
export const FIRESTORE_WRITE_BATCH_SIZE = 400;

/** Default chunk size for Firestore `getAll` and `in` query reads. */
export const FIRESTORE_READ_CHUNK_SIZE = 300;

/**
 * Splits a list into fixed-size chunks.
 *
 * @param values The values to split.
 * @param size The maximum chunk size.
 * @returns The chunked values.
 */
export function chunkValues<T>(values: T[], size: number): T[][] {
  if (size <= 0) {
    throw new RangeError("Chunk size must be greater than zero.");
  }

  const chunks: T[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
