# Stage 4B Solution

## 1. Summary of Optimizations Made

- Added deterministic query normalization before cache lookup.
- Switched repeated read paths to canonical cache keys instead of raw request strings.
- Improved natural-language query parsing so equivalent phrases can normalize to the same filters.
- Kept the existing HTTP API unchanged.
- Added explicit PostgreSQL connection pooling settings.
- Kept query reads lighter by using separate `count` and `findAll` operations instead of `findAndCountAll`.
- Added a streaming CSV import workflow for large files without loading the whole file into memory.
- Kept CSV imports chunked and bulk-inserted so they do not run row-by-row.

## 2. Before vs After Performance Comparison

These are practical sample comparisons based on the changed code path. A full 1M-row benchmark was not run in this workspace because there is no benchmark dataset or live tuned database fixture here.

| Area | Before | After |
| --- | --- | --- |
| Repeated identical list/search request | Always hits DB | Warm cache can return from memory in low single-digit milliseconds |
| Equivalent natural-language phrasing | Different cache key, cache miss | Same normalized key, cache hit |
| Large list query execution | `findAndCountAll` mixed path | Separate `count` + `findAll` path |
| Concurrent DB usage | Implicit Sequelize defaults | Explicit pooled connections |
| Large CSV ingestion | No dedicated large-file path | Streams line-by-line and bulk inserts in chunks |
| Invalid rows during import | No streaming import behavior | Skipped without failing whole job |

## 3. Explanation

### Caching strategy

- Cache stays simple and in-memory.
- Cache TTL defaults to 30 seconds.
- Cache keys are built from normalized query descriptors, not raw input text.
- Profile read caches are cleared after create and delete operations.

Why this helps:
- repeated queries stop hitting PostgreSQL every time
- equivalent inputs can reuse the same cached result

### Normalization logic

- The parser converts input into structured filters first.
- Filters are then rebuilt into a canonical object with a fixed key order.
- Standardized values are used before serialization:
  - gender stays lowercase
  - country code stays uppercase
  - age and probability values stay numeric
- The normalized descriptor is serialized with a stable JSON structure.

Example:

- `Nigerian females between ages 20 and 45`
- `Women aged 20-45 living in Nigeria`

Both now normalize to the same filter shape and the same cache key.

### Ingestion strategy

- CSV import is exposed as CLI so the API stays unchanged.
- Command:

```bash
npm run import:profiles:csv -- ./path/to/profiles.csv
```

- The file is read as a stream.
- Rows are parsed one line at a time.
- Valid rows are buffered into chunks.
- Each chunk checks existing names, skips duplicates, and bulk inserts the rest.
- Invalid rows are counted and skipped.
- Earlier inserted chunks stay committed even if a later chunk fails.

Returned summary shape:

```json
{
  "status": "success",
  "total_rows": 500000,
  "inserted": 497100,
  "skipped": 2900,
  "reasons": {
    "duplicate_name": 1800,
    "invalid_age": 400,
    "missing_fields": 300,
    "malformed": 400
  }
}
```

## 4. Trade-offs and Limitations

- In-memory cache is per-process only.
- Query normalization only unifies phrases that the deterministic parser can safely map.
- The CSV importer is line-based, so quoted multi-line CSV cells are treated as malformed.
- Duplicate-name protection uses the same lowercase lookup rule as profile creation, but true cross-process lowercase uniqueness would still need a stronger database-level constraint.
- This task improved CSV ingestion. CSV export is still in-memory because the API contract was left unchanged.

## 5. Edge Cases Handled

- equivalent query phrasing with reordered or differently worded filters
- age ranges like `between ages 20 and 45`
- age ranges like `aged 20-45`
- country adjectives like `nigerian`
- mixed query parameter ordering
- duplicate names inside the same CSV file
- missing required CSV fields
- invalid negative age values
- malformed CSV rows with broken quoting or wrong column counts
- partial import success when later chunks fail

## Validation

- Test suite result: 15 passed, 0 failed.

## Notes

- Existing auth, RBAC, and API routes were kept intact.
- CSV ingestion was added as CLI intentionally so the existing HTTP API does not change.