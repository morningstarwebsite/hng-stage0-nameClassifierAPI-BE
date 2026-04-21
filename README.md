# HNG Stage 2 - Profile Intelligence Service

This project continues the Stage 1 profile intelligence service without rebuilding it. A single name is still validated, enriched through Genderize, Agify, and Nationalize, transformed into assessment-specific fields, stored in PostgreSQL through Sequelize, and served back through the existing MVC API. Stage 2 adds an intelligence query engine with combined filtering, sorting, pagination, and rule-based natural-language search on top of the same `profiles` table.

## What It Does

- Accepts a name through `POST /api/profiles`
- Calls Genderize, Agify, and Nationalize in parallel
- Transforms upstream data before persistence
- Stores only processed profile fields, never raw API payloads
- Deduplicates by unique `name`
- Uses UUID v7 IDs and UTC ISO 8601 timestamps
- Supports lookup, filtered listing, sorting, pagination, natural-language search, and deletion
- Runs an explicit schema migration for the `profiles` table
- Prepares one-time idempotent JSON seeding for larger 2026 datasets

## Final Database Schema

The `profiles` table is aligned to this final required structure:

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `UUID v7` | Primary key |
| `name` | `VARCHAR` | Person's full name, unique |
| `gender` | `VARCHAR` | `male` or `female` |
| `gender_probability` | `FLOAT` | Confidence score |
| `age` | `INT` | Exact age |
| `age_group` | `VARCHAR` | `child`, `teenager`, `adult`, `senior` |
| `country_id` | `VARCHAR(2)` | ISO country code |
| `country_name` | `VARCHAR` | Full country name |
| `country_probability` | `FLOAT` | Confidence score |
| `created_at` | `TIMESTAMP` | Auto-generated |

Schema notes:

- `name` is unique at the database level
- `gender` is constrained to `male` or `female`
- `age_group` is constrained to `child`, `teenager`, `adult`, or `senior`
- `created_at` is generated automatically by PostgreSQL
- Legacy transition columns such as `normalized_name`, `probability`, `sample_size`, and `updated_at` are not part of the final schema

## Tech Stack

- Node.js
- JavaScript ES modules
- Express 5
- Sequelize
- PostgreSQL
- Railway deployment

## API Endpoints

### `POST /api/profiles`

Create a profile from a request body:

```json
{
  "name": "Amina"
}
```

Success response:

```json
{
  "status": "success",
  "data": {
    "id": "01963f64-b93d-7d6d-91cb-842f0b7f7d31",
    "name": "Amina",
    "gender": "female",
    "gender_probability": 0.99,
    "age": 31,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": "Nigeria",
    "country_probability": 0.81,
    "created_at": "2026-04-16T12:00:00.000Z"
  }
}
```

Duplicate response:

```json
{
  "status": "success",
  "message": "Profile already exists",
  "data": {
    "id": "01963f64-b93d-7d6d-91cb-842f0b7f7d31",
    "name": "Amina",
    "gender": "female",
    "gender_probability": 0.99,
    "age": 31,
    "age_group": "adult",
    "country_id": "NG",
    "country_name": "Nigeria",
    "country_probability": 0.81,
    "created_at": "2026-04-16T12:00:00.000Z"
  }
}
```

### `GET /api/profiles/:id`

Returns a single stored profile or `404` if it does not exist.

### `GET /api/profiles`

Returns paginated stored profiles with combined filtering and sorting. Supported optional case-insensitive query filters:

- `gender`
- `age_group`
- `country_id`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`

Supported sorting parameters:


Example:

```bash
curl "http://localhost:3200/api/profiles?gender=female&country_id=ng&age_group=adult&min_gender_probability=0.8&sort_by=created_at&order=desc&page=1&limit=10"
```

Response shape:

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 24,
  "data": [
    {
      "id": "01963f64-b93d-7d6d-91cb-842f0b7f7d31",
      "name": "Amina",
      "gender": "female",
      "gender_probability": 0.99,
      "age": 31,
      "age_group": "adult",
      "country_id": "NG",
      "country_name": "Nigeria",
      "country_probability": 0.81,
      "created_at": "2026-04-16T12:00:00.000Z"
    }
  ]
}
```

### `GET /api/profiles/search?q=...`

Runs a rule-based natural-language search and returns the same pagination structure as `GET /api/profiles`.

Examples:

```bash
curl "http://localhost:3200/api/profiles/search?q=young%20males"
curl "http://localhost:3200/api/profiles/search?q=females%20above%2030"
curl "http://localhost:3200/api/profiles/search?q=adult%20males%20from%20kenya&sort_by=age&order=asc"
```

If a query cannot be interpreted, the API returns:

```json
{
  "status": "error",
  "message": "Unable to interpret query"
}
```

### `DELETE /api/profiles/:id`

Deletes a stored profile and returns `204 No Content`.

## Validation Rules

- Missing `name` -> `400`
- Empty `name` -> `400`
- Wrong type for `name` -> `422`
- Missing `q` for search -> `400`
- Empty `q` for search -> `400`
- Invalid query parameter types or values -> `422`
- Invalid upstream profile data -> `404`
- Upstream connectivity or response failures -> `502`

Query parameter validation rules:

- Unknown query parameters are rejected
- `page` and `limit` must be positive integers
- `limit > 50` is rejected with `422`
- `sort_by` must be `age`, `created_at`, or `gender_probability`
- `order` must be `asc` or `desc`
- `gender` must be `male` or `female`
- `age_group` must be `child`, `teenager`, `adult`, or `senior`
- `country_id` must be a two-letter country code
- `min_age` cannot exceed `max_age`
- Probability filters must be numeric values from `0` to `1`

Every failed request returns JSON in this format:

```json
{
  "status": "error",
  "message": "<message>"
}
```

## Data Processing Rules

- Genderize: uses `gender` and `probability`; stores the confidence score as `gender_probability`; treats `gender: null` or `count: 0` as invalid
- Agify: uses `age`; derives `age_group` as `child`, `teenager`, `adult`, or `senior`; treats `age: null` as invalid
- Nationalize: selects the country with the highest probability; stores it as `country_id`, derives `country_name`, and stores `country_probability`; treats empty country lists as invalid

## Natural-Language Parsing

The search endpoint uses deterministic rule-based parsing only. No AI model, LLM, embeddings, or fuzzy generation is involved.

Supported keyword families:

- Gender keywords: `male`, `males`, `man`, `men`, `boy`, `boys` map to `gender=male`
- Gender keywords: `female`, `females`, `woman`, `women`, `girl`, `girls` map to `gender=female`
- Age-group keywords: `child`, `children`, `teen`, `teens`, `teenager`, `teenagers`, `adult`, `adults`, `senior`, `seniors`
- Special age phrase: `young` maps to `min_age=16` and `max_age=24` for parsing only
- Minimum-age phrases: `above 30`, `over 30`, `older than 30`, `at least 30`
- Maximum-age phrases: `below 20`, `under 20`, `younger than 20`, `at most 20`
- Country phrases: `from angola`, `from kenya`, and other English country names that resolve to ISO 3166-1 alpha-2 country codes

Parsing behavior:

- The parser normalizes the query to lowercase and checks it for supported keywords and phrases
- If only one gender family is present, that gender filter is added
- If both male and female terms are present, gender is treated as ambiguous and omitted instead of forcing one side
- Age groups can be combined with numeric bounds, for example `teenagers above 17`
- The parser resolves `from <country name>` into a stored `country_id` value
- The resulting parsed filters are passed into the same Sequelize query builder used by `GET /api/profiles`

Examples:

- `young males` -> `gender=male`, `min_age=16`, `max_age=24`
- `females above 30` -> `gender=female`, `min_age=30`
- `people from angola` -> `country_id=AO`
- `adult males from kenya` -> `gender=male`, `age_group=adult`, `country_id=KE`
- `male and female teenagers above 17` -> `age_group=teenager`, `min_age=17`

Parser limitations:

- It only understands the supported keyword and phrase families documented above
- It does not infer intent from arbitrary prose or unsupported synonyms
- It does not persist `young` as a database age group; it only expands it into an age range during parsing
- Queries with no recognized rule match return `Unable to interpret query`

## Seeding Large 2026 Data

The codebase is prepared for a one-time JSON seed file import.

Expected item format:

```json
{
  "id": "01963f64-b93d-7d6d-91cb-842f0b7f7d31",
  "name": "Amina",
  "gender": "female",
  "gender_probability": 0.99,
  "age": 31,
  "age_group": "adult",
  "country_id": "NG",
  "country_name": "Nigeria",
  "country_probability": 0.81
}
```

Run it with:

```bash
npm run seed:profiles -- ./path/to/seed.json
```

The seeder accepts either:

- a raw JSON array of profile objects
- an object with a top-level `profiles` array, such as `seed_profiles.json`

Duplicate prevention:

- The database enforces uniqueness on `name`
- The seed script checks for an existing profile by case-insensitive `name`
- If a matching profile already exists, it updates the existing row instead of creating a duplicate
- Re-running the same seed file is therefore idempotent

## Project Structure

```text
src/
  app.js
  server.js
  config/
    database.js
  controllers/
    profileController.js
  middleware/
    errorHandler.js
  migrations/
    20260416-create-profiles.js
    20260421-align-profiles-required-schema.js
    20260421-stage2-profile-query-updates.js
    runMigrations.js
  models/
    index.js
    profile.js
  routes/
    profileRoutes.js
  services/
    countryLookupService.js
    profileQueryService.js
    profileSearchService.js
    profileService.js
    profileTransformService.js
    upstreamService.js
  scripts/
    seedProfiles.js
  utils/
    appError.js
test/
  profileQuery.test.js
  profileTransform.test.js
```

## Setup

### Prerequisites

- Node.js 22+
- PostgreSQL

### Environment Variables

Use either a single Railway-style connection string or individual PostgreSQL values.

```env
PORT=3200
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/profile_intelligence

# or
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=profile_intelligence
DB_USER=postgres
DB_PASSWORD=postgres
```

### Install

```bash
npm install
```

### Run Database Migration

```bash
npm run migrate
```

The server also runs pending migrations on startup.

### Run Locally

```bash
npm run dev
```

or

```bash
npm start
```

The app listens on `http://localhost:3200` by default.

## Testing

Run the lightweight business-rule tests with:

```bash
npm test
```

You can also smoke test the HTTP API manually:

```bash
curl -X POST "http://localhost:3200/api/profiles" \
  -H "Content-Type: application/json" \
  -d '{"name":"Amina"}'

curl "http://localhost:3200/api/profiles?gender=female&sort_by=created_at&order=desc&page=1&limit=10"

curl "http://localhost:3200/api/profiles/search?q=young%20males"
```

## Deploying to Railway

1. Provision a PostgreSQL database in Railway.
2. Set `DATABASE_URL` in the Railway service environment if it is not injected automatically.
3. Deploy this repository as a Node.js service.
4. Railway provides `PORT`; the app uses it automatically.
5. On startup, the app connects to PostgreSQL and applies any pending schema migrations.

Example deployed health check:

```bash
curl "https://your-railway-app.up.railway.app/"
```
