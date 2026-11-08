### Do's

- Use explicit Firestore document types instead of repeated casts.
- Keep write operations atomic when they represent one logical action. If one succeeds and the other fails, state becomes
  inconsistent.
- Standardize DB folder/file layout across domains.
- Keep DB folder names aligned with collection/domain naming, and prefer pluralized folder names for collection-backed domains.
- Keep db-schema.md upto date with the collection models.
- keep `firestore.indexes.json` aligned with expected query patterns for reporting-heavy collections.
- Use `DbValidationError` consistently for DB document shape and mapper validation failures.
- Use a typed module-level collection constant. Reuse it directly instead of calling `getAdminFirestore().collection()` inline.
- Use `collection.firestore.batch()` or `collection.firestore.runTransaction()` for batch/transaction operations.
- Always use the mapper's serialize functions instead of inline serialization logic in db files.
- Give every persisted model a `schemaVersion` field and bump it in `db/schema/schema-version.ts` whenever the stored shape changes. See
  [schema-versioning.md](./schema-versioning.md).
- Migrate raw documents through `migrateDocument` in the mapper's normalize function before validating them, and write the current version from the
  mapper's serialize function.
- Add forward-only, pure, idempotent migrations to `db/schema/schema-migrations.ts` instead of editing an existing migration.
- Run the `backfill_schema_versions` data job in dry-run mode before persisting a new schema version.

### Don'ts

- No Presentational logic should be there in the db layer
- No direct calls should be made to the db layer from the client component
