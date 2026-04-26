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

### Don'ts

- No Presentational logic should be there in the db layer
- No direct calls should be made to the db layer from the client component
