# HNG Stage 1 - Profile Intelligence Service

This project extends the original Stage 0 Express API into a Stage 1 profile intelligence service. A single name is validated, enriched through Genderize, Agify, and Nationalize on every create request, transformed into assessment-specific fields, stored in PostgreSQL through Sequelize, and served back through a clean MVC API.

## What It Does

- Accepts a name through `POST /api/profiles`
- Calls Genderize, Agify, and Nationalize in parallel
- Transforms upstream data before persistence
- Stores only processed profile fields, never raw API payloads
- Deduplicates by normalized name
- Uses UUID v7 IDs and UTC ISO 8601 timestamps
- Supports lookup, filtered listing, and deletion
- Runs an explicit schema migration for the `profiles` table

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
    "probability": 0.99,
    "sample_size": 1250,
    "age": 31,
    "age_group": "adult",
    "country_id": "NG",
    "country_probability": 0.81,
    "created_at": "2026-04-16T12:00:00.000Z",
    "updated_at": "2026-04-16T12:00:00.000Z"
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
    "probability": 0.99,
    "sample_size": 1250,
    "age": 31,
    "age_group": "adult",
    "country_id": "NG",
    "country_probability": 0.81,
    "created_at": "2026-04-16T12:00:00.000Z",
    "updated_at": "2026-04-16T12:00:00.000Z"
  }
}
```

### `GET /api/profiles/:id`

Returns a single stored profile or `404` if it does not exist.

### `GET /api/profiles`

Returns all stored profiles. Supported optional case-insensitive query filters:

- `gender`
- `country_id`
- `age_group`

Example:

```bash
curl "http://localhost:3200/api/profiles?gender=female&country_id=ng&age_group=adult"
```

### `DELETE /api/profiles/:id`

Deletes a stored profile and returns `204 No Content`.

## Validation Rules

- Missing `name` -> `400`
- Empty `name` -> `400`
- Wrong type for `name` -> `422`
- Invalid upstream profile data -> `404`
- Upstream connectivity or response failures -> `502`

Every failed request returns JSON in this format:

```json
{
  "status": "error",
  "message": "<message>"
}
```

## Data Processing Rules

- Genderize: uses `gender`, `probability`, and `count`; stores `count` as `sample_size`; treats `gender: null` or `count: 0` as invalid
- Agify: uses `age`; derives `age_group` as `child`, `teenager`, `adult`, or `senior`; treats `age: null` as invalid
- Nationalize: selects the country with the highest probability; stores it as `country_id` and `country_probability`; treats empty country lists as invalid

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
  models/
    index.js
    profile.js
  routes/
    profileRoutes.js
  services/
    profileService.js
    profileTransformService.js
    upstreamService.js
  utils/
    appError.js
test/
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

curl "http://localhost:3200/api/profiles"
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
