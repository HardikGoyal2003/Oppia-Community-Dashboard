# Schema Versioning

Every Firestore-backed model in this project carries a `schemaVersion` field so
that stored documents can be evolved without breaking reads. This document
explains the conventions and the process for changing a persisted model.

## Conventions

- The field is always named `schemaVersion` and is a positive integer on
  persisted documents.
- App-layer/domain types extend `SchemaVersioned` from `lib/domain/schema.types.ts`.
- Documents written before versioning existed have no field and are treated as
  legacy version `0` (`LEGACY_SCHEMA_VERSION`).
- `1` is the first versioned shape. It is the shape produced by the shared
  migration that adds `schemaVersion`; there are no other structural changes
  between legacy `0` and `1`.
- Versions are per model, not global. Each model has its own entry in
  `SCHEMA_VERSIONS`.
- Published versions are never reused or renumbered.

The source of truth for versions lives in `db/schema/schema-version.ts`:

- `SCHEMA_KEYS` — stable identifiers for each model. Keys are not collection
  names; they stay attached to a model even if a collection is renamed.
- `SCHEMA_VERSIONS` — the latest version supported by the application for each
  model.
- `getCurrentSchemaVersion` / `readSchemaVersion` / `assertSchemaVersion` —
  helpers used by mappers and serializers.

## Reading Documents

Mappers are the only place that read raw Firestore documents. Every normalizer
follows the same order:

1. Call `migrateDocument(key, rawDocument)` from
   `db/schema/schema-migrations.ts`.
2. Validate the migrated document (including `assertSchemaVersion`).
3. Normalize timestamps and return the app-layer model, including the migrated
   `schemaVersion`.

This means old documents are upgraded lazily on read. A document at a version
newer than the app supports is rejected with `DbValidationError` rather than
being silently normalized with an unknown shape.

## Writing Documents

Mappers serialize app-layer models to Firestore-ready documents and always write
the current version via `getCurrentSchemaVersion(key)`. Write helpers accept
`Omit<Model, "schemaVersion">` when the caller must not supply a version, so the
current version cannot drift between call sites.

Do **not** add `schemaVersion` to partial `.update()` payloads. Marking a
document as current without running the field migrations would corrupt its
version. Partial updates should leave the existing `schemaVersion` untouched;
the next migration/backfill pass will stamp it.

## Migrations

`db/schema/schema-migrations.ts` defines the migration registry:

```ts
export type SchemaMigration = {
  toVersion: number;
  migrate: (
    document: FirebaseFirestore.DocumentData,
  ) => FirebaseFirestore.DocumentData;
};
```

`migrateDocument` runs migrations in order, one version at a time, until the
document reaches the current version. Migrations must be:

- **Forward-only.** Never mutate an already-published migration; add a new one.
- **Pure.** No I/O, no reads of other documents.
- **Idempotent.** Running the migration on an already-migrated document must
  produce the same result.
- **Total.** Return a complete document shape for `toVersion`.

## Evolving a Model

To change a persisted model:

1. Bump the model's version in `SCHEMA_VERSIONS` (`db/schema/schema-version.ts`).
2. Add a migration with the matching `toVersion` to `SCHEMA_MIGRATIONS`
   (`db/schema/schema-migrations.ts`). `toVersion` must be exactly the previous
   version plus one.
3. Update the Firestore type, mapper, and app-layer/domain types.
4. Update `db/db-schema.md` and this document if the process changes.
5. Run the backfill job (see below) to persist the new shape.
6. Run `npm run type-check` and `npm run lint`.

Example migration for version 2 of a model that adds a `status` field:

```ts
{
  toVersion: 2,
  migrate: (document) => ({
    ...document,
    status: document.status ?? "PENDING",
    schemaVersion: 2,
  }),
}
```

## Backfill Job

Reads migrate lazily, but persisted data should eventually be upgraded so that
queries and exports see the current shape. The manual **Backfill Schema
Versions** data job (`backfill_schema_versions`) scans every versioned
collection and collection group, migrates documents through `migrateDocument`,
and writes the result.

- It is registered in `lib/data-jobs/data-jobs.service.ts`.
- It supports dry-run mode; use dry-run first to inspect the counts.
- Documents already at the current version are skipped.
- Failures are counted and logged per document; the job does not abort the
  whole pass.
- Because `migrateDocument` is idempotent, rerunning the job is safe.

## Adding a New Versioned Model

1. Add a key to `SCHEMA_KEYS` and set its current version in `SCHEMA_VERSIONS`.
2. Add an entry to `SCHEMA_MIGRATIONS` for the new key.
3. Add the model to `buildSchemaCollectionTargets` in
   `db/schema/schema-migration-runner.ts` so the backfill job covers it.
4. Add `schemaVersion` to the Firestore type, mapper, and domain type.
5. Document the collection in `db/db-schema.md`.
