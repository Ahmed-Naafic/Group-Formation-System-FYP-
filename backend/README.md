# Group Formation System — Backend

Node.js / Express API for the Advanced Automated Student Group Formation System.

> **Monorepo note:** This backend lives inside the `backend/` subfolder of the repo.
> All commands below must be run from inside `backend/`.

---

## Prerequisites

- Node.js v18 or higher
- MongoDB running locally (default port 27017) **or** a MongoDB Atlas connection string

---

## Setup

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.example .env

# 4. Edit .env and set your MONGODB_URI if using Atlas
#    The default value works for a local MongoDB installation.
```

---

## Running the server

```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Server starts on **http://localhost:5000** by default.

---

## Phase 1 — Insomnia test checklist

| # | Request | Expected |
|---|---------|----------|
| 1 | `GET /health` | 200 — `{ success: true, data: { server: "ok", database: "connected", ... } }` |
| 2 | `GET /does-not-exist` | 404 — `{ success: false, error: { code: "NOT_FOUND", ... } }` |
| 3 | `POST /health` with body `{ bad json` | 400 — `{ success: false, error: { code: "BAD_REQUEST", message: "Malformed JSON..." } }` |
| 4 | Stop MongoDB, then `GET /health` | 503 — `{ success: true, data: { database: "disconnected" } }` |

---

## Project structure (Phase 1)

```
backend/
├── server.js               ← Entry point
├── src/
│   ├── app.js              ← Express app wiring
│   ├── config/
│   │   ├── env.js          ← Env var validation (fails fast on missing vars)
│   │   └── db.js           ← MongoDB connection with retry + graceful shutdown
│   ├── common/
│   │   ├── errors/         ← AppError base class + concrete subclasses + error codes
│   │   ├── responses/      ← sendSuccess() builder
│   │   ├── utils/
│   │   │   ├── logger.js   ← Winston (pretty in dev, JSON in prod)
│   │   │   └── asyncHandler.js
│   │   └── plugins/
│   │       └── softDelete.js
│   └── middleware/
│       ├── errorHandler.js ← Global error handler
│       └── notFound.js     ← 404 catch-all
├── .env                    ← Local secrets (gitignored)
├── .env.example            ← Template committed to git
└── package.json
```
