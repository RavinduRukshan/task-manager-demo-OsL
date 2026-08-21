# Task Manager — Offline-Sync-Lite v0.4.0 Benchmark & Research Demo

A full-stack offline-first Task Management research application built with **Next.js 14** (frontend), **Express.js + PostgreSQL** (backend), and **`offline-sync-lite@0.4.0`**.

This application is designed to demonstrate, benchmark, and evaluate the 10 advanced architectural features of `offline-sync-lite` against a traditional direct REST fetch baseline.

---

## Architecture & Project Structure

```
task-manager-demo-OsL/
├── backend/                  Express.js REST API & PostgreSQL Pool (Port 4000)
│   ├── schema.sql            Database schema with indexes, tags, points & tenant user_id
│   ├── .env                  Environment variables (PORT, DATABASE_URL)
│   └── src/
│       ├── index.js          Server entry point with CORS headers & autoMigrate()
│       ├── db.js             PostgreSQL connection pool & idempotent schema migration
│       └── routes/
│           └── tasks.js      CRUD, ?since= incremental sync, ?userId= tenant filter,
│                             POST /batch atomic sync, 422 DLQ poison pill trigger,
│                             NTP Date calibration & x-schema-version headers
└── frontend/                 Next.js 14 App Router + MUI UI (Port 3000)
    ├── package.json          Includes offline-sync-lite@0.4.0, xlsx, mui
    └── src/
        ├── app/
        │   ├── layout.js     Theme & Emotion cache provider
        │   ├── page.js       Redirect to /tasks
        │   └── tasks/
        │       ├── page.js   Main task board + Sync Monitor dock
        │       ├── new/      Task creation page (with active tenant default)
        │       └── [id]/edit/ Task edit page (with tag management & point merge)
        ├── components/
        │   ├── TopBar.js           Tenant switcher, Vault encryption modal, 2nd tab launcher, seed
        │   ├── TaskCard.js         Card with status, priority, #tag chips, points & tenant badges
        │   ├── TaskForm.js         Form with multi-tag chip builder, story points & poison pill toggle
        │   └── SyncMonitorPanel.js Right-docked metrics, live event logs, cycle logs, run summaries,
        │                           consistency validator, Clock Skew tool, Schema Migration manager,
        │                           DLQ inspector, CSV/Excel exporter
        └── services/
            ├── syncLogger.js       Logging, counters, and run ID generators
            ├── dataService.js      Dispatcher facade switching between SDK & direct fetch
            └── adapters/
                ├── libraryAdapter.js   Full offline-sync-lite@0.4.0 integration
                └── baselineAdapter.js  Direct fetch baseline for comparative analysis
```

---

## Prerequisites

| Requirement | Minimum Version | Recommended |
|-------------|-----------------|-------------|
| Node.js     | 18.x            | 20.x LTS    |
| npm         | 9.x             | 10.x        |
| PostgreSQL  | 14.x            | 16.x        |

---

## 1 — Database Setup

### Step A: Create the database in PostgreSQL
```bash
psql -U postgres
```
```sql
CREATE DATABASE taskmanager;
\q
```

### Step B: Configure environment variables
Edit `backend/.env` with your PostgreSQL credentials:
```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskmanager
```

> **Note:** The backend automatically runs idempotent database migrations on startup (`db.autoMigrate()`), ensuring tables, columns (`tags`, `points`, `user_id`), and indexes are created automatically.

---

## 2 — Start the Backend Server

```bash
cd backend
npm install
npm run dev
```
Backend starts on **http://localhost:4000**.

---

## 3 — Start the Frontend Application

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** in your browser.

---

## 10 Core Architectural Features in `offline-sync-lite@0.4.0`

### 1. Multi-User Tenant Isolation & Account Switching
- **Partitioned Storage:** Local IndexedDB tables and queues are scoped per-tenant (`offline-sync-lite:alice`, `offline-sync-lite:bob`).
- **Live Switching:** `client.switchUser(newUserId)` aborts active sync loops, cleans up prior resources, re-initializes storage, updates BroadcastChannels, and notifies reactive subscribers.
- **Data Purge on Logout:** `client.purge()` securely destroys tenant-specific IndexedDB tables on sign-out.

### 2. At-Rest Web Crypto AES-GCM-256 Envelope Encryption
- **Client-Side Hardware Cryptography:** Uses native `window.crypto.subtle` AES-GCM-256 with PBKDF2 key derivation (100,000 iterations).
- **Protection:** Encrypts local IndexedDB records and queued mutation payloads on disk, preventing physical storage snooping and browser exfiltration.
- **Configurable:** Managed dynamically in the TopBar **Vault** dialog.

### 3. Field-Level Conflict Merging & Custom Resolvers
- **Granular Resolvers:** Utilizes `createFieldMergeResolver({ deep: true, strategies: { tags: 'union', points: 'max' } })`.
- **Eliminates Lost Updates:** If User A changes `tags` while User B updates `points` offline, both updates are cleanly merged upon reconnect rather than clobbering each other.

### 4. Multi-Tab Concurrency & Web Locks
- **Leader Election:** Synchronizes mutations across tabs using `navigator.locks` to prevent duplicate concurrent network pushes.
- **Cross-Tab Reactivity:** Uses `BroadcastChannel` to immediately update all open browser tabs whenever one tab modifies local state or pulls remote changes.
- **Testable:** Click **"2nd Tab"** in the TopBar to launch side-by-side tabs.

### 5. Clock Skew Mitigation & Monotonic Causality
- **Passive NTP-Lite Calibration:** Automatically tracks server RTT and `Date` response headers to compute `clockOffset`.
- **Monotonic Sequence Clock:** Generates causality-preserving timestamps even if device clocks are intentionally skewed into the past or future.
- **Interactive Simulator:** Click **"Clock"** in the Sync Monitor Panel to apply artificial clock drift (`-10s`, `+5s`, `+60s`).

### 6. Domain Schema Versioning & At-Rest Migrations
- **Stepwise Pipeline:** Sequential migrations (`v1 -> v2: tags/points formatting`, `v2 -> v3: status normalization`) transform stored IndexedDB records and queued operations without wiping local cache.
- **Server Drift Detection:** When remote API sends a higher `x-schema-version`, the SDK detects drift and triggers notifications.

### 7. Poison Pill Protection & Dead-Letter Queue (DLQ)
- **Non-Retryable 4xx Handling:** Distinguishes temporary network failures (5xx, timeout) from permanent client errors (400, 422, 403).
- **Quarantine:** Operations exceeding failure thresholds are moved to the DLQ (`op_dead_letter`), unblocking the rest of the queue.
- **DLQ Management:** Inspect, retry, or discard quarantined ops from the **DLQ** dialog.

### 8. Cache Eviction & Storage Management
- **LRU / Timestamp Eviction:** `cacheLimits` and `pruneCache(maxRecords)` prune oldest cached items while strictly preserving records with unsynced local mutations.
- **Clear Cache:** `clearCache()` clears read cache without deleting pending operation queues.

### 9. Auto-Sync & Dynamic Online/Offline Reconnect
- **Background Synchronization:** Configurable periodic polling with pause/resume controls.
- **Instant Reconnect Trigger:** Automatically initiates queue draining upon `window.online` events.

### 10. High-Throughput REST API & Atomic Batch Endpoint
- Supports individual CRUD alongside `POST /api/tasks/batch` for high-throughput multi-operation syncs.

---

## Research Benchmark Scenarios (S1 – S10)

The application includes 10 predefined benchmark scenarios selectable in the **Sync Monitor Panel**:

| Scenario ID | Name | Primary Objective & Validation |
|-------------|------|--------------------------------|
| **S1** | **Offline Create & Reconnect** | Take browser offline, create tasks, verify local availability, reconnect online, and confirm queue drains cleanly. |
| **S2** | **Rapid Repeated Update & Coalescing** | Edit the same task 10 times offline; verify operation queue coalesces mutations to minimize network payload. |
| **S3** | **Temporary Server Failure & Backoff** | Stop backend or throttle network; verify exponential backoff and retry counters without data loss. |
| **S4** | **Concurrent Edit Conflict & Field Merge** | Concurrently edit different fields of the same task in two tabs/clients; verify `tags: union` and `points: max` resolve without lost updates. |
| **S5** | **Poison Pill 4xx & Dead-Letter Queue** | Inject an invalid mutation (`Poison Pill` button); verify 422 quarantine into DLQ without blocking subsequent tasks. |
| **S6** | **Multi-Tab Concurrency & Web Locks** | Open 2 tabs side-by-side; perform simultaneous edits; verify `navigator.locks` leader election and real-time BroadcastChannel sync. |
| **S7** | **Multi-User Tenant Isolation** | Switch users (Alice → Bob); verify separate IndexedDB databases and zero data bleed across accounts. |
| **S8** | **At-Rest Vault Encryption** | Set a vault passphrase; inspect browser IndexedDB storage to verify AES-GCM-256 ciphertext on disk. |
| **S9** | **Domain Schema Versioning & Migration** | Advance schema version to v2/v3; verify stepwise record transformation and server drift alerts. |
| **S10** | **Clock Skew Mitigation & Monotonicity** | Skew device clock offset by +60s or -10s; perform edits; verify causality is preserved without timestamp bugs. |

---

## Evaluating & Exporting Research Data

1. **Start Run:** Select a Scenario (e.g., `S1`) and click **"Start Run"**.
2. **Execute Actions:** Perform tasks, offline toggles, or conflict simulations.
3. **End Run:** Click **"End Run"** to compute latency metrics, cycle counts, payload sizes, and queue drain times.
4. **Consistency Check:** Click **"Check"** to perform automated state reconciliation between local IndexedDB and server PostgreSQL.
5. **Export Data:** Click **"Export CSV"** for individual logs or **"Export Excel"** to download a unified 4-sheet research workbook containing:
   - **Sync Cycle Log** (per-cycle HTTP counts, payload KB, applied updates)
   - **Run Summary** (aggregated success rate, average latency, consistency status)
   - **Event Log** (microsecond lifecycle event audit trail)
   - **Consistency Check Log** (field-by-field expected vs actual state validation)

---

## REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks (supports `?since=ISO` incremental sync and `?userId=tenant` filter) |
| `POST` | `/api/tasks` | Create a task (accepts `title`, `description`, `status`, `priority`, `tags`, `points`, `userId`) |
| `GET` | `/api/tasks/:id` | Fetch single task by ID |
| `PATCH` | `/api/tasks/:id` | Update task fields (with optimistic concurrency check) |
| `DELETE` | `/api/tasks/:id` | Delete task by ID |
| `POST` | `/api/tasks/batch` | Atomic batch synchronization endpoint |
| `POST` | `/api/tasks/config/schema-version` | Dynamically simulate server schema version advancement |
| `POST` | `/api/tasks/config/seed` | Seed demo data for Alice and Bob |
