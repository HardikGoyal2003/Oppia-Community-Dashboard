# Firestore index workflow

Firestore composite indexes are part of the application contract. Every database
function that combines a filter with `orderBy` must document its supported index
shapes with `@firestore-index` tags in the function JSDoc.

The `check:firestore-indexes` script validates that each declared index exists in
`firestore.indexes.json`. It also checks that every field used by the function's
ordered query is covered by at least one declaration. This catches both a new
query field without an updated contract and a contract that was not added to the
Firebase index configuration.

When adding an optional filter, declare every supported filter combination. Keep
the field order in the tag identical to the corresponding Firebase index.

Run the check locally with:

```sh
npm run check:firestore-indexes
```

The same check runs automatically for pull requests that change database query
code or the index configuration.
