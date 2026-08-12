# Task Manager App

Full-stack Task Management application built with **Next.js 14** (frontend) and **Express.js + PostgreSQL** (backend).  
Designed as a research baseline for comparing data synchronisation strategies: _Without Library_ vs _With Library_.

---

## Project Structure

```
task-manager-app/
├── backend/               Express.js REST API (port 4000)
│   ├── schema.sql         Database schema
│   ├── .env               Environment variables
│   └── src/
│       ├── index.js       Entry point + middleware
│       ├── db.js          PostgreSQL pool
│       └── routes/
│           └── tasks.js   All task endpoints
└── frontend/              Next.js 14 App Router (port 3000)
    ├── .env.local         Frontend environment variables
    └── src/
        ├── app/           Pages (layout, /, /tasks, /tasks/new, /tasks/[id]/edit)
        ├── components/    UI components (TaskCard, TaskForm, TopBar, SyncMonitorPanel)
        ├── services/
        │   └── dataService.js   Swappable data-layer adapter
        └── theme/
            └── theme.js   MUI theme
```

---

## Prerequisites

| Requirement | Minimum version |
|-------------|----------------|
| Node.js     | 18.x            |
| npm         | 9.x             |
| PostgreSQL  | 14.x            |

---

## 1 — Database Setup

### Create the database

```bash
psql -U postgres
```

```sql
CREATE DATABASE taskmanager;
\q
```

### Run the schema

```bash
psql -U postgres -d taskmanager -f backend/schema.sql
```

### Update the connection string (if needed)

Edit `backend/.env` and set your PostgreSQL credentials:

```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskmanager
```

---

## 2 — Backend

```bash
cd backend
npm install
npm run dev          # starts with nodemon on http://localhost:4000
```

### Available endpoints

| Method | Path                   | Description                          |
|--------|------------------------|--------------------------------------|
| POST   | /api/tasks             | Create a task                        |
| GET    | /api/tasks             | List all tasks (optional ?since=ISO) |
| GET    | /api/tasks/:id         | Get a single task                    |
| PATCH  | /api/tasks/:id         | Update a task (with conflict check)  |
| DELETE | /api/tasks/:id         | Delete a task                        |
| POST   | /api/tasks/batch       | Batch create / update / delete       |

---

## 3 — Frontend

```bash
cd frontend
npm install
npm run dev          # starts Next.js on http://localhost:3000
```

Open **http://localhost:3000** — you will be redirected to `/tasks`.

---

## 4 — Research Notes: offline-sync-lite Analysis

This app was built to perform a **comprehensive analysis of the `offline-sync-lite` library (v0.1.1)** — comparing it against a hand-rolled baseline sync implementation across reliability, offline behaviour, conflict resolution, and developer experience.

### Identified Bug in offline-sync-lite v0.1.1

**File:** `node_modules/offline-sync-lite/src/createSyncClient.js`  
**Location:** inside the `syncNow()` function (~line 188)

**Bug:** `createSyncEngine` is declared as an `async function`, which means calling it returns a `Promise`. However, the call site does not `await` it:

```js
// Actual library code (broken):
const engine = createSyncEngine({ ... });   // engine is a Promise, NOT the engine object
const result = await engine.syncNow(...);   // engine.syncNow is undefined → TypeError
```

The `TypeError` is immediately caught by the surrounding `try/catch`, which silently returns `{ ok: false }`. No network request is ever made. Every call to `syncNow()` — including the push phase (queued ops) and the pull phase (fetching server records) — silently fails.

**Impact:**
- Server records are never pulled into local IndexedDB on first load.
- Queued offline operations are never pushed to the server.
- `syncSuccessRate` stays at 0%, `appliedUpdates` always 0.
- The library's local CRUD (IndexedDB reads/writes) and operation queueing still work correctly.

**Correct code (not applied — library source preserved for analysis):**
```js
const engine = await createSyncEngine({ ... });  // await required
```

### How the App Works Around This

`dataService.js` (the With-Library variant) uses **direct `fetch()` calls** for all server communication, exactly as the baseline version does. The library is retained for:
- Local IndexedDB persistence (offline writes)
- Operation queue management (observable via `queuedOpsCount` metric)
- Event system (`onEvent` callback, `subscribe`)
- Metrics collection (retryCount, conflictsDetected)

When the device is offline, CRUD operations fall through to the library's local path, and the queue builds up — demonstrating that the library's offline-first storage layer works as designed.

---

## 5 — Switching Between Baseline and Library Mode

The entire data layer is encapsulated in a single file:

```
frontend/src/services/dataService.js
```

### Current mode — Baseline ("Without Library")

All CRUD operations use direct `fetch()` calls to the REST API.  
`syncNow()`, `getMetrics()`, and auto-sync controls are stubs that return zeros.

### To enable Library mode ("With Library")

1. Back up the current baseline adapter:
   ```bash
   cp frontend/src/services/dataService.js frontend/src/services/dataService.baseline.js
   ```

2. Replace `dataService.js` with your library implementation.  
   The new file **must export the same interface**:

   ```js
   export async function create(task)          // → record
   export async function update(id, patch)     // → record
   export async function remove(id)            // → { ok: true }
   export async function get(id)               // → record
   export async function list()                // → record[]
   export function syncNow()                   // → Promise<{ ok, pushedOps, failedOps, appliedUpdates, durationMs }>
   export function getMetrics()                // → { syncSuccessRate, avgSyncLatencyMs, retryCount, queuedOpsCount, conflictsDetected }
   export function subscribe(fn)               // → unsub()
   export function startAutoSync()
   export function stopAutoSync()
   export function pauseSync()
   export function resumeSync()
   ```

3. No changes are required in any UI component — the Sync Monitor Panel and all pages will automatically reflect real metrics and events from the new adapter.

---

## Task Data Format

All tasks are exchanged in this canonical shape:

```json
{
  "id": "uuid-v4-string",
  "data": {
    "title": "string",
    "description": "string",
    "status": "open | in-progress | done",
    "priority": "low | medium | high",
    "assignee": "string"
  },
  "updatedAt": "2026-01-01T00:00:00.000Z",
  "serverVersion": 1
}
```

---

## UI Overview

| Element | Description |
|---------|-------------|
| TopBar | App title, mode toggle, Sync Now, Add Task |
| Task board | Responsive card grid (1–4 columns) |
| Status chips | open=blue, in-progress=orange, done=green |
| Priority chips | low=grey, medium=yellow, high=red |
| Sync Monitor Panel | Always-visible bottom bar: online badge, metrics, event log, controls |
| Snackbar | Toast notification for create / update / delete / error |

---

## Development Notes

- **Conflict detection** — `PATCH /api/tasks/:id` returns `HTTP 409` with `{ error: 'conflict', remoteRecord }` when the server record was modified after the client's last known `updatedAt`.
- **Incremental sync** — `GET /api/tasks?since=<ISO>` returns only tasks updated after the given timestamp, ready for the library mode to use.
- **Batch endpoint** — `POST /api/tasks/batch` accepts an array of `{ type, id, payload }` operations for offline-first sync queues.
