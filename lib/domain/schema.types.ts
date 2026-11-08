/**
 * Base shape shared by every Firestore-backed model.
 *
 * `schemaVersion` records which version of the persisted model shape a
 * document conforms to. It is written by the DB layer's serializers and
 * normalized (after migrations) by the DB layer's mappers.
 */
export type SchemaVersioned = {
  schemaVersion: number;
};
