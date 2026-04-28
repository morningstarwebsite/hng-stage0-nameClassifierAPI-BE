# Insighta Labs+ Stage 3 Backend

This repository extends the existing HNG Stage 2 profile intelligence API into a secured Stage 3 platform without rebuilding the original system. The Stage 2 profile enrichment, filtering, sorting, pagination, and natural-language search behavior remain in place, and Stage 3 layers GitHub OAuth with PKCE, rotating sessions, role-based access control, API version enforcement, CSV export, rate limiting, and request logging on top.

## Architecture

The project keeps the original Node.js, JavaScript ES modules, Express, Sequelize, PostgreSQL, and Railway deployment stack.

Request flow:

1. Express receives the request in [src/app.js](src/app.js).
2. Global middleware applies CORS, cookies, structured request logging, rate limiting, CSRF checks, API version checks, and authentication.
3. Routes delegate to controllers in [src/controllers](src/controllers).
4. Controllers call service-layer logic for auth, tokens, authorization, profile queries, export, and upstream profile enrichment.
5. Sequelize models in [src/models](src/models) persist profiles, users, and refresh tokens in PostgreSQL.
6. Startup runs the explicit migration runner in [src/migrations/runMigrations.js](src/migrations/runMigrations.js) before serving traffic.

## Stage 3 Features

- Keeps Stage 2 profile behavior for filtering, sorting, pagination, and natural-language search.
- Adds GitHub OAuth login with PKCE.
- Creates or updates application users in a `users` table.
- Uses short-lived access tokens and rotating refresh tokens.
- Protects every `/api/*` route.
- Enforces `X-API-Version: 1` on all `/api/*` requests.
- Adds CSV export for filtered profile datasets.
- Adds admin and analyst roles with centralized authorization guards.
- Adds in-process rate limiting and structured request logging.
- Uses HTTP-only cookies for browser sessions plus CSRF protection on state-changing session-backed requests.

## Data Model

### Profiles

The existing `profiles` table remains the main intelligence dataset.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `UUID v7` | Primary key |
| `name` | `VARCHAR` | Unique |
| `gender` | `VARCHAR` | `male` or `female` |
| `gender_probability` | `FLOAT` | Confidence score |
| `age` | `INT` | Exact age |
| `age_group` | `VARCHAR` | `child`, `teenager`, `adult`, `senior` |
| `country_id` | `VARCHAR(2)` | ISO country code |
| `country_name` | `VARCHAR` | Derived country name |
| `country_probability` | `FLOAT` | Confidence score |
| `created_at` | `TIMESTAMP` | UTC timestamp |

### Users

Stage 3 adds a `users` table.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `UUID v7` | Primary key |
| `github_id` | `VARCHAR` | Unique GitHub user id |
| `username` | `VARCHAR` | GitHub login |
| `email` | `VARCHAR` | Optional |
| `avatar_url` | `TEXT` | Optional |
| `role` | `ENUM` | `admin` or `analyst`, default `analyst` |
| `is_active` | `BOOLEAN` | Default `true` |
| `last_login_at` | `TIMESTAMP` | Updated on successful GitHub login |
| `created_at` | `TIMESTAMP` | Created timestamp |

### Refresh Tokens

Stage 3 also adds a `refresh_tokens` table to support session rotation.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `UUID v7` | Primary key |
| `user_id` | `UUID` | Foreign key to `users.id` |
| `token_hash` | `VARCHAR` | Stored hashed token value |
| `expires_at` | `TIMESTAMP` | 5 minute expiry |
| `revoked_at` | `TIMESTAMP` | Set immediately on logout or refresh rotation |
| `replaced_by_token_id` | `UUID` | Rotation chain reference |
| `user_agent` | `TEXT` | Optional request metadata |
| `ip_address` | `VARCHAR` | Optional request metadata |
| `created_at` | `TIMESTAMP` | Created timestamp |

## Authentication Flow

Only GitHub OAuth is supported.

1. Client calls `GET /auth/github`.
2. The backend generates a PKCE verifier and state value, stores them in short-lived cookies, and redirects to GitHub.
3. GitHub redirects back to `GET /auth/github/callback`.
4. The backend validates state, exchanges the code using PKCE, fetches the GitHub profile and email data, and upserts the local user.
5. The backend issues:
   - a 3 minute JWT access token
   - a 5 minute opaque refresh token stored hashed in PostgreSQL
   - an HTTP-only access token cookie
   - an HTTP-only refresh token cookie
   - a CSRF token cookie for state-changing browser requests
6. `POST /auth/refresh` rotates the refresh token immediately and issues a new access token and CSRF token.
7. `POST /auth/logout` revokes the current refresh token and clears session cookies.

Inactive users are blocked with `403` on all protected requests, including refresh.

## Role Model

- `admin`: full profile access, including `POST /api/profiles` and `DELETE /api/profiles/:id`
- `analyst`: read-only access to listing, lookup, search, and export endpoints

Role checks are centralized through middleware and the authorization service rather than being scattered through controllers.

## API Versioning

Every `/api/*` request must include:

```http
X-API-Version: 1
```

If the header is missing, the API returns:

```json
{
  "status": "error",
  "message": "API version header required"
}
```

with `400 Bad Request`.

## Endpoints

### Auth

- `GET /auth/github`
- `GET /auth/github/callback`
- `POST /auth/refresh`
- `POST /auth/logout`

### Profiles

All `/api/*` endpoints require authentication and `X-API-Version: 1`.

- `GET /api/profiles`
- `GET /api/profiles/search`
- `GET /api/profiles/:id`
- `POST /api/profiles`
- `DELETE /api/profiles/:id`
- `GET /api/profiles/export?format=csv`

## Querying and Pagination

Stage 2 filtering, sorting, and natural-language parsing are preserved.

Supported list filters:

- `gender`
- `age_group`
- `country_id`
- `min_age`
- `max_age`
- `min_gender_probability`
- `min_country_probability`
- `sort_by`
- `order`
- `page`
- `limit`

Search continues to use `GET /api/profiles/search?q=...` and the same sorting and pagination parameters.

Paginated responses now include:

```json
{
  "status": "success",
  "page": 1,
  "limit": 10,
  "total": 24,
  "total_pages": 3,
  "links": {
    "self": "https://api.example.com/api/profiles?page=1&limit=10",
    "next": "https://api.example.com/api/profiles?page=2&limit=10",
    "prev": null
  },
  "data": []
}
```

## CSV Export

`GET /api/profiles/export?format=csv` reuses the same validated filter and sorting logic as `GET /api/profiles`.

Behavior:

- honors the same direct filters
- honors the same sort parameters
- exports the filtered dataset in current sort order
- does not require a separate query language
- returns CSV in this exact column order:

```text
id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at
```

## Security Controls

### Sessions and Cookies

- access token cookie: HTTP-only, 3 minutes
- refresh token cookie: HTTP-only, 5 minutes
- CSRF token cookie: readable by the client so it can be echoed in `X-CSRF-Token`
- OAuth state and PKCE verifier cookies are short-lived and cleared after callback

### CSRF

CSRF protection applies to session-backed state-changing requests such as:

- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /api/profiles`
- `DELETE /api/profiles/:id`

If the request uses session cookies, the caller must send `X-CSRF-Token` matching the `csrf_token` cookie.

### CORS

The API allows wildcard CORS:

```http
Access-Control-Allow-Origin: *
```

### Rate Limiting

- `/auth/*`: 10 requests per minute
- all other protected routes: 60 requests per minute per authenticated user

### Logging

Every request is logged in structured form with:

- method
- endpoint
- status code
- response time

## Consistent Error Format

All handled errors return JSON in this shape:

```json
{
  "status": "error",
  "message": "<message>"
}
```

## Project Structure

```text
src/
  app.js
  server.js
  config/
    database.js
  controllers/
    authController.js
    profileController.js
  middleware/
    apiVersion.js
    authentication.js
    authorization.js
    csrfProtection.js
    errorHandler.js
    rateLimiter.js
    requestLogger.js
  migrations/
    20260416-create-profiles.js
    20260421-align-profiles-required-schema.js
    20260421-stage2-profile-query-updates.js
    20260428-stage3-auth-and-security.js
    runMigrations.js
  models/
    index.js
    profile.js
    refreshToken.js
    user.js
  routes/
    authRoutes.js
    profileRoutes.js
  services/
    authCookieService.js
    authService.js
    authorizationService.js
    countryLookupService.js
    exportService.js
    paginationService.js
    profileQueryService.js
    profileSearchService.js
    profileService.js
    profileTransformService.js
    tokenService.js
    upstreamService.js
  scripts/
    seedProfiles.js
  utils/
    appError.js
    env.js
test/
  profileQuery.test.js
  profileTransform.test.js
  stage3Infrastructure.test.js
```

## Local Setup

### Prerequisites

- Node.js 22+
- PostgreSQL
- a GitHub OAuth app

### Environment Variables

Copy the example values from [.env.example](.env.example).

Required application settings:

```env
PORT=3200
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/profile_intelligence
ACCESS_TOKEN_SECRET=replace-with-a-long-random-secret
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
GITHUB_REDIRECT_URI=http://localhost:3200/auth/github/callback
```

Optional database split variables if `DATABASE_URL` is not used:

```env
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=profile_intelligence
DB_USER=postgres
DB_PASSWORD=postgres
NODE_ENV=development
```

### Install

```bash
npm install
```

### Run Migrations

```bash
npm run migrate
```

The app also runs pending migrations automatically at startup.

### Start the Server

```bash
npm run dev
```

or

```bash
npm start
```

## Testing

Run the unit tests with:

```bash
npm test
```

Manual smoke examples after authenticating:

```bash
curl -H "Authorization: Bearer <access-token>" -H "X-API-Version: 1" "http://localhost:3200/api/profiles?gender=female&page=1&limit=10"

curl -H "Authorization: Bearer <access-token>" -H "X-API-Version: 1" "http://localhost:3200/api/profiles/search?q=young%20males"

curl -H "Authorization: Bearer <access-token>" -H "X-API-Version: 1" "http://localhost:3200/api/profiles/export?format=csv&country_id=NG&sort_by=created_at&order=desc"
```

## Railway Deployment

1. Provision PostgreSQL in Railway.
2. Set `DATABASE_URL` if Railway does not inject it automatically.
3. Set `ACCESS_TOKEN_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, and `GITHUB_REDIRECT_URI`.
4. Ensure `GITHUB_REDIRECT_URI` uses your deployed Railway URL, for example `https://your-app.up.railway.app/auth/github/callback`.
5. Deploy the service with `npm start`.
6. On boot the service authenticates to PostgreSQL and runs pending migrations.
7. Test the root route and the OAuth callback URL after deployment.
