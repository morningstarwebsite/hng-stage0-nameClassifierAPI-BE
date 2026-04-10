# HNG Stage 0 — Gender Classification API

A lightweight REST API that predicts the gender of a given name by integrating with the [Genderize.io](https://genderize.io) API. Built with **Node.js**and **Express** as a clean MVC project.

---

## Endpoint

```
GET /api/classify?name={name}
```

### Query Parameters

| Parameter | Type   | Required | Description           |
|-----------|--------|----------|-----------------------|
| `name`    | string | Yes      | The name to classify  |

---

## Response Examples

### Success

```json
{
  "name": "James",
  "gender": "male",
  "probability": 0.98,
  "sample_size": 144669,
  "is_confident": true,
  "processed_at": "2025-07-15T10:23:45.123Z"
}
```

### No Prediction Available

```json
{
  "status": "error",
  "message": "No prediction available for the provided name"
}
```

### Validation Error (400)

```json
{
  "status": "error",
  "message": "The 'name' query parameter is required and cannot be empty"
}
```

---

## `is_confident` Logic

| Condition                        | Value   |
|----------------------------------|---------|
| `probability >= 0.7` AND `sample_size >= 100` | `true`  |
| Otherwise                        | `false` |

---

## Error Codes

| Status | Meaning                                     |
|--------|---------------------------------------------|
| 400    | Missing or empty `name` parameter           |
| 422    | `name` is not a plain string                |
| 502    | Upstream Genderize API is unreachable       |
| 500    | Unexpected internal server error            |

---

## Project Structure

```
hng-stage0/
├── src/
│   ├── controllers/
│   │   └── classify.controller.js   # Input validation + response shaping
│   ├── services/
│   │   └── genderize.service.js     # Genderize API fetch logic
│   ├── routes/
│   │   └── classify.routes.js       # Route definitions
│   ├── app.js                       # Express app (CORS, middleware, routes)
│   └── server.js                    # Entry point — starts the HTTP server
├── .env
├── .gitignore
├── package.json
└── README.md
```

---

## Local Setup

### Prerequisites

- Node.js **v18 or higher** (uses the built-in `fetch` API)

### Install & Run

```bash
# 1. Clone the repository
git clone https://github.com/morningstarwebsite/hng-stage0-nameClassifierAPI-BE.git
cd hng-stage0

# 2. Install dependencies
npm install

# 4. Start the server
npm start
```

The server starts on `http://localhost:3200` by default.

For development with auto-restart on file changes:

```bash
npm run dev
```

---

## Testing

No test framework is required — you can verify every case with `curl` or your browser.

```bash
# Happy path
curl "http://localhost:3200/api/classify?name=James"

# Missing name (400)
curl "http://localhost:3200/api/classify"

# Empty name (400)
curl "http://localhost:3200/api/classify?name="

# Name with no prediction (uncommon name)
curl "http://localhost:3200/api/classify?name=Zxqwerty"

# Health check
curl "http://localhost:3200/"
```

---

## Deploying to Railway

1. Push your code to a GitHub repository.
2. Go to [railway.app](https://railway.app) and create a **New Project → Deploy from GitHub repo**.
3. Select your repository. Railway will auto-detect Node.js.
4. Railway automatically injects the `PORT` environment variable — no manual configuration needed.
5. Your API will be live at the Railway-provided public URL.

**Verify after deploy:**

```bash
curl "https://your-app.up.railway.app/api/classify?name=James"
```

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4 
- **External API:** [Genderize.io](https://genderize.io)
- **CORS:** Wildcard origin (`*`)
- **Database:** None
