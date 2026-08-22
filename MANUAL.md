# Task Manager — Offline-Sync-Lite v0.4.0  
## Complete Application Manual & Test Case Guide

**Version:** 0.4.0  
**Stack:** Next.js 14 (Frontend) · Express.js + PostgreSQL (Backend) · `offline-sync-lite@0.4.0`  
**Last Updated:** August 2026

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Prerequisites & Setup](#3-prerequisites--setup)
4. [Application Layout & Pages](#4-application-layout--pages)
5. [Top Bar — Complete Button & Feature Reference](#5-top-bar--complete-button--feature-reference)
6. [Task Board — Main Page Features](#6-task-board--main-page-features)
7. [Task Card — Elements & Buttons](#7-task-card--elements--buttons)
8. [Task Form — Create & Edit Page Features](#8-task-form--create--edit-page-features)
9. [Sync Monitor Panel — Complete Feature Reference](#9-sync-monitor-panel--complete-feature-reference)
10. [Dialog Windows — All Modal Dialogs](#10-dialog-windows--all-modal-dialogs)
11. [Dual-Mode Architecture (SDK vs. Direct Fetch)](#11-dual-mode-architecture-sdk-vs-direct-fetch)
12. [10 Core Architectural Features](#12-10-core-architectural-features)
13. [REST API Reference](#13-rest-api-reference)
14. [Research Benchmark Scenarios (S1–S10)](#14-research-benchmark-scenarios-s1s10)
15. [Complete Test Case Guide](#15-complete-test-case-guide)

---

## 1. Application Overview

The Task Manager is a full-stack **offline-first** task management research application designed to demonstrate, benchmark, and evaluate the 10 advanced architectural features of the `offline-sync-lite@0.4.0` library against a traditional direct REST fetch baseline.

The application serves as both a **functional task manager** and a **research instrumentation platform**, featuring real-time sync monitoring, benchmark scenario execution, data export capabilities, and automated consistency validation.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| **Task CRUD** | Create, read, update, and delete tasks with rich metadata (tags, story points, priority, assignee) |
| **Offline-First** | Tasks created offline are queued and automatically synced when connectivity is restored |
| **Multi-User** | Tenant-isolated partitions (Alice, Bob, Charlie, or custom) with separate IndexedDB databases |
| **Encryption** | AES-GCM-256 at-rest encryption for local IndexedDB storage with PBKDF2 key derivation |
| **Multi-Tab** | Web Locks leader election + BroadcastChannel real-time cross-tab synchronization |
| **Conflict Resolution** | Field-level merge strategies (tags = union, points = max) for granular conflict resolution |
| **Research Tools** | 10 benchmark scenarios, 4-tab data logging, CSV/Excel export, automated consistency checks |

---

## 2. Architecture & Technology Stack

### Frontend (Port 3000)
- **Framework:** Next.js 14 (App Router)
- **UI Library:** Material-UI (MUI) v5
- **Sync Engine:** `offline-sync-lite@0.4.0`
- **Local Storage:** IndexedDB (via SDK), localStorage (for mode/log persistence)
- **Export Library:** SheetJS (xlsx) for Excel workbook generation

### Backend (Port 4000)
- **Framework:** Express.js
- **Database:** PostgreSQL with connection pool (`pg`)
- **API Style:** RESTful JSON with CORS headers, NTP Date calibration, schema version headers

### Adapter Pattern
The frontend uses a **dispatcher facade** (`dataService.js`) that routes all calls to one of two adapters:
- **`libraryAdapter.js`** — Full `offline-sync-lite` SDK integration (with-library mode)
- **`baselineAdapter.js`** — Direct HTTP fetch baseline (without-library mode)

---

## 3. Prerequisites & Setup

### System Requirements

| Requirement | Minimum Version | Recommended |
|-------------|-----------------|-------------|
| Node.js     | 18.x            | 20.x LTS    |
| npm         | 9.x             | 10.x        |
| PostgreSQL  | 14.x            | 16.x        |

### Step 1 — Database Setup

```bash
psql -U postgres
```
```sql
CREATE DATABASE taskmanager;
\q
```

Configure `backend/.env`:
```dotenv
PORT=4000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/taskmanager
```

> **Note:** The backend automatically runs idempotent database migrations on startup (`db.autoMigrate()`), ensuring tables, columns, and indexes are created automatically.

### Step 2 — Start the Backend

```bash
cd backend
npm install
npm run dev
```
Backend starts on **http://localhost:4000**.

### Step 3 — Start the Frontend

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:3000** in your browser. The root page auto-redirects to `/tasks`.

---

## 4. Application Layout & Pages

### Page Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Root redirect | Redirects to `/tasks` |
| `/tasks` | Main task board | Displays task cards grid + right-docked Sync Monitor Panel |
| `/tasks/new` | Create task | TaskForm for creating a new task |
| `/tasks/[id]/edit` | Edit task | TaskForm pre-filled with existing task data |

### Main Page Layout (`/tasks`)

The main page is divided into three vertical sections:

```
+--------------------------------------------------------+
|                     TOP BAR                             |
| [User: alice v] [Vault] [2nd Tab] [Seed] [SDK] [Sync] [+ Add Task] |
+-------------------------------------+------------------+
|                                     |                  |
|         TASK CARD GRID              |   SYNC MONITOR   |
|                                     |     PANEL        |
|   +-----+ +-----+ +-----+          |   (right-dock)   |
|   |Card | |Card | |Card |          |                  |
|   |  1  | |  2  | |  3  |          |  [metrics]       |
|   +-----+ +-----+ +-----+          |  [data tabs]     |
|                                     |  [export bar]    |
|   +-----+ +-----+                  |                  |
|   |Card | |Card |                  |                  |
|   |  4  | |  5  |                  |                  |
|   +-----+ +-----+                  |                  |
|                                     |                  |
+-------------------------------------+------------------+
```

---

## 5. Top Bar — Complete Button & Feature Reference

The Top Bar is the primary navigation and control strip displayed at the top of every page. Below is every interactive element, from left to right.

---

### 5.1 Application Title
- **Element:** "Task Manager" text label
- **Behavior:** Static title display, non-interactive

---

### 5.2 `User: [userId] v` — Multi-User Tenant Selector
- **Icon:** Person icon (left) + dropdown arrow (right)
- **Appearance:** Outlined button with semi-transparent background
- **Purpose:** Switch the active tenant partition to isolate data by user
- **Click Action:** Opens a dropdown menu with:

| Menu Item | Action |
|-----------|--------|
| **Alice (Tenant A)** | Switch to user `alice`; scopes IndexedDB to `offline-sync-lite:alice` |
| **Bob (Tenant B)** | Switch to user `bob`; scopes IndexedDB to `offline-sync-lite:bob` |
| **Charlie (Tenant C)** | Switch to user `charlie`; scopes IndexedDB to `offline-sync-lite:charlie` |
| **Custom Tenant ID...** | Opens the Custom Tenant Dialog for entering any arbitrary user ID |
| **Purge old DB on switch** | Checkbox — when checked, the previous user's IndexedDB database is destroyed on switch (data purge). Default: unchecked |

- **What Happens on Switch:**
  1. Active sync loops are aborted
  2. Prior resources are cleaned up
  3. IndexedDB storage is re-initialized for the new user
  4. BroadcastChannels are updated
  5. Task list is refreshed with new tenant's data
  6. A snackbar confirmation appears

---

### 5.3 `Vault: AES-256` / `Vault: Plain` — Encryption Badge
- **Icon:** Lock icon when encrypted; Open lock when plain
- **Appearance:** Green filled chip when encrypted; outlined chip when unencrypted
- **Visibility:** Only visible in SDK mode (`with-library`)
- **Click Action:** Opens the Vault Encryption Dialog
- **Tooltip:**
  - When encrypted: "At-Rest Storage Encryption ACTIVE (Web Crypto AES-GCM-256)"
  - When plain: "At-Rest Storage Encryption DISABLED (Click to configure)"

---

### 5.4 `2nd Tab` — Multi-Tab Concurrency Launcher
- **Icon:** Tab icon
- **Appearance:** Outlined button
- **Purpose:** Opens a duplicate browser tab for testing Web Locks & BroadcastChannel sync
- **Click Action:** Calls `window.open(window.location.href, '_blank')` — opens the same page in a new tab
- **Tooltip:** "Open a 2nd tab side-by-side to test Web Locks & real-time BroadcastChannel sync"
- **Use Case:** Side-by-side tab testing for Scenario S6 (Multi-Tab Concurrency)

---

### 5.5 `Seed` — Demo Data Seeder
- **Icon:** AutoAwesome (sparkle) icon
- **Appearance:** Outlined button
- **Purpose:** Seeds the PostgreSQL database with 4 pre-defined demo tasks (2 for Alice, 2 for Bob)
- **Click Action:** Sends `POST /api/tasks/config/seed` to backend, then triggers a sync
- **Tooltip:** "Seed multi-user test tasks for Alice and Bob"
- **Seeded Tasks:**

| ID | Title | User | Status | Priority | Points |
|----|-------|------|--------|----------|--------|
| seed-task-1 | Review offline-sync-lite architecture | alice | in-progress | high | 5 |
| seed-task-2 | Test Web Crypto AES-GCM at-rest encryption | alice | open | medium | 3 |
| seed-task-3 | Test cross-tab Web Locks mutual exclusion | bob | open | high | 4 |
| seed-task-4 | Validate Dead-Letter Queue poison pill quarantine | bob | done | low | 2 |

---

### 5.6 `SDK` — Mode Toggle Switch
- **Elements:** "SDK" label + MUI Switch toggle
- **Purpose:** Switches between the two operational modes
- **States:**

| Position | Mode | Adapter Used | Description |
|----------|------|-------------|-------------|
| **ON** (right) | `with-library` | `libraryAdapter.js` | Full offline-sync-lite SDK with IndexedDB, operation queue, encryption, Web Locks, conflict merging, DLQ, schema migrations |
| **OFF** (left) | `without-library` | `baselineAdapter.js` | Direct HTTP fetch baseline — no local storage, no queue, no offline support |

- **Toggle Action:** Switches the active adapter in `dataService.js`, stores preference in `localStorage` key `syncMode`, shows snackbar confirmation
- **Persisted:** Mode survives navigation and hard refreshes via localStorage

---

### 5.7 `Sync Now` — Manual Sync Trigger
- **Icon:** Sync (rotation) icon
- **Appearance:** Text button
- **Purpose:** Immediately triggers a full sync cycle
- **Click Action:**
  - In SDK mode: Pushes all queued offline operations to the server, then pulls latest records from server
  - In Baseline mode: Fetches the latest task list from the REST API
- **Feedback:** Shows green "Sync complete" or red "Sync failed" snackbar notification

---

### 5.8 `Add Task` — Create New Task
- **Icon:** Plus (+) icon
- **Appearance:** Contained button with semi-transparent white background
- **Purpose:** Navigate to the task creation page
- **Click Action:** Calls `router.push('/tasks/new')` — navigates to the Create Task page

---

## 6. Task Board — Main Page Features

### 6.1 Task Grid
- **Layout:** Responsive CSS Grid — 4 columns (lg), 3 columns (md), 2 columns (sm), 1 column (xs)
- **Content:** Displays one `TaskCard` component per task
- **Scrolling:** Vertical scroll within the main content area
- **Data Source:** Tasks are loaded via `dataService.list()` and reactively updated through the pub/sub subscription

### 6.2 Empty State
When no tasks exist for the current tenant, the board shows:
- A large grey circle-plus icon
- Message: "No tasks for tenant "[userId]" — create one or seed demo tasks!"
- Two buttons:
  - **Create Task** (contained) — navigates to `/tasks/new`
  - **Seed Demo Tasks** (outlined) — seeds demo data

### 6.3 Loading State
- Displays a centered `CircularProgress` spinner while tasks are being loaded

### 6.4 Snackbar Notifications
- **Position:** Top-right corner
- **Auto-dismiss:** 3.5 seconds
- **Types:** Success (green), Error (red), Info (blue), Warning (orange)
- **Triggered by:** All CRUD operations, sync actions, user switches, encryption changes, errors

---

## 7. Task Card — Elements & Buttons

Each task is rendered as a Material-UI `Card` with hover animation effects (translateY lift + shadow enhancement).

### 7.1 Card Information Elements

| Element | Position | Description |
|---------|----------|-------------|
| **Title** | Top-left | Bold task title (truncated with ellipsis if too long) |
| **Points Badge** | Top-right | Blue outlined chip showing "X pt" with bolt icon (only if points > 0) |
| **Status Chip** | Below title | Colored chip: `open` (blue), `in-progress` (orange), `done` (green) |
| **Priority Chip** | Next to status | Outlined chip: `low` (grey), `medium` (yellow), `high` (red) |
| **User Badge** | Next to priority | Outlined chip showing the tenant/owner user ID (e.g., `alice`) with person icon |
| **Assignee** | Below chips | "**Assignee:** [name]" text (if assignee is set) |
| **Description** | Below assignee | Grey text, clamped to 2 lines with ellipsis overflow |
| **Tag Chips** | Below description | Array of purple outlined `#tag` chips (e.g., `#sync`, `#urgent`) |
| **Updated Timestamp** | Bottom of content | "Updated: HH:MM:SS AM/PM - v[serverVersion]" |

### 7.2 Card Action Buttons

| Button | Icon | Color | Action |
|--------|------|-------|--------|
| **Edit** | Edit pencil | Primary (blue) | Navigates to `/tasks/[id]/edit` |
| **Delete** | Delete trash | Error (red) | Calls `dataService.remove(id)` — deletes the task locally and/or on server |

---

## 8. Task Form — Create & Edit Page Features

The `TaskForm` component is shared between the Create (`/tasks/new`) and Edit (`/tasks/[id]/edit`) pages.

### 8.1 Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| **Task Title** | Text input | Yes | Empty | Main title of the task. Validated — shows "Title is required" error |
| **Description** | Multiline textarea (3 rows) | No | Empty | Optional detailed description |
| **Status** | Dropdown select | No | `open` | Options: `open`, `in-progress`, `done` |
| **Priority** | Dropdown select | No | `medium` | Options: `low`, `medium`, `high` |
| **Assignee** | Text input | No | Empty | Free-text assignee name (e.g., "Alice", "Bob") |
| **Story Points / Hours** | Number input | No | `3` | Numeric field (0-100) used for Field-Merge Demo (`points: max` strategy) |
| **Tenant / Owner User ID** | Text input | No | Active user ID | Multi-user partition tenant identifier |
| **Simulate Poison Pill** | Checkbox | No | Unchecked | When checked, task creation will intentionally fail with 422 error for DLQ testing |

### 8.2 Tags Section (Field-Level Array Union Merge)
- **Header:** "Tags (Demonstrates Granular Array Union Conflict Resolution)"
- **Add Tag Input:** Text field + **Add** button. Tags can also be added by pressing Enter
- **Active Tags:** Displayed as blue filled chips with delete (x) buttons
- **Quick Suggested Tags:** Pre-defined clickable chips: `sync`, `urgent`, `bug`, `v0.4.0`, `security`, `frontend`, `backend`
- **Tag Normalization:** Tags are trimmed, lowercased, and `#` prefix is stripped

### 8.3 Form Buttons

| Button | Appearance | Action |
|--------|------------|--------|
| **Cancel** | Outlined | Navigates back to `/tasks` |
| **Create Task** / **Update Task** | Contained (primary blue) | Submits the form. Shows loading spinner during submission |
| **Inject Poison Pill** | Contained (error red) | Appears when "Simulate Poison Pill" checkbox is checked. Submits with `poisonPill: true` which triggers a 422 server error |

---

## 9. Sync Monitor Panel — Complete Feature Reference

The Sync Monitor Panel is a **right-docked resizable panel** that provides comprehensive sync monitoring, research instrumentation, and data export capabilities.

### 9.1 Panel Header

| Element | Description |
|---------|-------------|
| **"Sync Monitor"** title | Panel name (shows "Sync" when collapsed) |
| **Collapse/Expand toggle** | Arrows to collapse (56px wide) or expand (640px default, resizable 320-960px) |
| **Online/Offline chip** | Green "Online" (WiFi icon) or Red "Offline" (WiFi-off icon) — auto-detected via browser `navigator.onLine` |
| **Mode chip** | "SDK v0.4.0" (blue) or "Direct Fetch" (grey) — reflects current adapter |
| **User chip** | Purple outlined "User: [userId]" chip |
| **Scenario selector** | Dropdown to select S1-S10 benchmark scenarios (or N/A). Disabled during active run |

### 9.2 Run Lifecycle Buttons

| Button | Icon | Color | Enabled When | Action |
|--------|------|-------|-------------|--------|
| **Start Run** | Play | Green (contained) | Scenario selected AND no active run | Begins a new benchmark run — initializes run counters, generates run ID |
| **End Run** | Stop | Red (contained) | Run is active | Ends the run — computes aggregated metrics, runs consistency check, saves run summary |
| **Check** | FactCheck | Default (outlined) | Run ID exists or run logs exist | Performs automated state reconciliation between local IndexedDB and server PostgreSQL |

### 9.3 Secondary Controls — Sync Action Bar

| Button | Color | Action |
|--------|-------|--------|
| **Sync Now** | Primary (contained) | Triggers an immediate manual sync cycle |
| **Auto Play** | Default (outlined) | Starts auto-sync polling (every 15 seconds by default) |
| **Auto Stop** | Default (outlined) | Stops auto-sync polling |
| **Pause** | Default (outlined) | Pauses auto-sync (retains paused state) |
| **Resume** | Default (outlined) | Resumes paused auto-sync and triggers an immediate sync |

### 9.4 Feature Action Buttons (SDK Mode Only)

These buttons are only visible when mode is `with-library`:

| Button | Icon | Color | Purpose | Click Action |
|--------|------|-------|---------|-------------|
| **Clock (Xms)** | AccessTime | Warning (if skewed) | View NTP clock offset & calibrate/simulate clock skew | Opens Clock Skew Simulator Dialog |
| **Schema vX** | DynamicFeed | Info (blue) | Manage domain schema versions and test migrations | Opens Schema Migration Dialog |
| **Poison Pill** | BugReport | Error (red) | Inject a poison pill operation | Creates a task with `poisonPill: true` and title `__POISON_PILL__` — triggers 422 and DLQ quarantine |
| **Prune Cache** | AutoDelete | Secondary (purple) | Prune oldest cached records from IndexedDB | Opens Prune Cache Dialog |
| **Clear Cache** | LayersClear | Warning (orange) | Clear all cached records (preserving unsynced ops queue) | Opens Clear Cache Dialog |
| **DLQ (N)** | WarningAmber | Error (red, if count > 0) | View & manage quarantined operations in Dead-Letter Queue | Opens DLQ Dialog |

### 9.5 Active Run Info Bar

| Element | Description |
|---------|-------------|
| **Run active chip** | Orange chip showing `Run active: [run_id]` (only when run is in progress) |
| **Scenario label** | Full scenario name (e.g., "S1 — Offline Create & Reconnect") |
| **IDB name** | Right-aligned caption showing IndexedDB database name + lock icon if encrypted |

### 9.6 Quick Metrics Row

Seven real-time metric badges displayed in a horizontal row:

| Metric | Description | Source |
|--------|-------------|--------|
| **Success Rate** | `X%` — percentage of successful sync cycles | `syncSuccessCount / totalSyncCount` |
| **Avg Latency** | `X ms` — average sync response time | Rolling average of last 20 sync durations |
| **Queued** | Number of pending operations in the local queue | SDK `getMetrics().queuedOpsCount` |
| **DLQ** | Number of quarantined dead-letter operations | SDK `getMetrics().deadLetteredOpsCount` (red if > 0) |
| **Retries** | Total retry attempts across all sync cycles | Cumulative retry counter |
| **Conflicts** | Total field-level conflicts detected and resolved | Cumulative conflict counter |
| **Clock Skew** | `X ms` — current client clock offset | SDK `getClockOffset()` (orange if not 0) |

### 9.7 Data Tabs

Four scrollable data tabs, each displaying a structured table:

#### Tab 1: Sync Cycle Log
Records per-cycle granular sync telemetry.

| Column | Description |
|--------|-------------|
| `cycle_id` | Sequential cycle number within the run |
| `run_id` | Parent run identifier |
| `scenario_id` | Active scenario (S1-S10 or N/A) |
| `mode` | `with_library` or `without_library` |
| `trigger` | What triggered the sync: `manual`, `auto`, `seed`, `online_resume`, `drift_test` |
| `success` | `yes` or `no` |
| `cycle_start_ts` | Cycle start timestamp |
| `cycle_end_ts` | Cycle end timestamp |
| `duration_ms` | Total cycle duration in milliseconds |
| `online_before` | Browser online status before sync |
| `online_after` | Browser online status after sync |
| `queue_before` | Queued ops count before sync |
| `queue_after` | Queued ops count after sync |
| `pushed_ops` | Number of operations pushed to server |
| `failed_ops` | Number of operations that failed |
| `applied_updates` | Number of records changed (added/modified/deleted) |
| `retries_cycle` | Retry attempts within this cycle |
| `conflicts_cycle` | Conflicts detected within this cycle |
| `http_req_cycle` | HTTP requests made in this cycle |
| `payload_kb_cycle` | Payload size in KB for this cycle |
| `error_code` | Error HTTP status code (if failed) |
| `error_summary` | Error message description |

#### Tab 2: Run Summary
Aggregated statistics per completed benchmark run.

| Column | Description |
|--------|-------------|
| `run_id` | Unique run identifier |
| `scenario_id` | Scenario that was tested |
| `mode` | Adapter mode used |
| `repeat_no` | Repeat iteration number for this scenario/mode combination |
| `run_start_ts` / `run_end_ts` | Run duration timestamps |
| `online_start` / `online_end` | Browser online status at start/end |
| `total_user_ops` | Total task CRUD operations performed by user |
| `total_cycles` | Total sync cycles executed |
| `http_requests_total` | Total HTTP requests made |
| `payload_kb_total` | Total payload in KB |
| `avg_response_ms` | Average response time |
| `sync_success_rate` | Percentage of successful syncs |
| `avg_sync_latency_ms` | Average sync latency |
| `retry_count_total` | Total retries |
| `max_queue_depth` | Maximum queue depth observed during run |
| `queue_drain_time_s` | Time from first queued op to queue empty (seconds) |
| `conflict_count_total` | Total conflicts detected |
| `lost_ops_count` | Operations lost (should be 0) |
| `final_consistency` | `yes`/`no` — result of post-run consistency check |
| `notes` | Any additional notes |

#### Tab 3: Event Log
Microsecond-precision lifecycle event audit trail.

| Column | Description |
|--------|-------------|
| `event_id` | Sequential event ID |
| `run_id` | Associated run (if any) |
| `cycle_id` | Associated sync cycle (if any) |
| `event_ts` | Event timestamp |
| `event_type` | Event type with visual chips |
| `task_id` | Associated task ID (if applicable) |
| `severity` | `info` (default), `warn` (orange), `error` (red) |
| `detail` | Human-readable event description |

**Event Types with Visual Chips:**

| Event Type | Chip Color | Description |
|------------|------------|-------------|
| `cache_pruned` | Secondary (outlined) | Cache pruning occurred |
| `cache_cleared` | Warning (outlined) | Cache was cleared |
| `op_dead_letter` | Error (filled) | Operation quarantined to DLQ |
| `sync_skipped` | Info (outlined) | Sync skipped (Web Lock held) |
| `schema_drift` | Warning (filled) | Server schema version mismatch detected |
| `schema_migrated` | Success (outlined) | Schema migration applied |
| `user_switched` | Primary (outlined) | Active tenant changed |
| `clock_calibrated` | Info (outlined) | Clock offset recalibrated |
| `dlq_retry` | Primary (outlined) | Dead-letter op re-queued for retry |
| `dlq_discard` | Warning (outlined) | Dead-letter ops discarded |

#### Tab 4: Consistency Check
Field-by-field comparison between local IndexedDB state and server PostgreSQL state.

| Column | Description |
|--------|-------------|
| `check_id` | Sequential check ID |
| `run_id` | Associated run |
| `checked_ts` | Timestamp of check |
| `task_id` | Task being compared |
| `expected_state` | JSON of expected server state |
| `local_state` | JSON of local state |
| `server_state` | JSON of server state |
| `is_consistent` | `yes` (green) or `no` (red) |
| `mismatch_type` | `missing_local`, `missing_server`, or `field_mismatch` |
| `mismatch_detail` | Human-readable description of the inconsistency |

### 9.8 Clear / Export Bar

| Button | Icon | Color | Action |
|--------|------|-------|--------|
| **Clear** | DeleteSweep | Error (outlined) | Opens confirmation dialog, then clears the current active tab's data |
| **Export CSV** | FileDownload | Default (outlined) | Exports the current tab's data as a `.csv` file |
| **Export Excel** | TableChart | Success (contained) | Exports **all 4 tabs** as a single `.xlsx` Excel workbook with 4 sheets: "Sync Cycle Log", "Run Summary", "Event Log", "Consistency Check" |

---

## 10. Dialog Windows — All Modal Dialogs

### 10.1 Custom Tenant ID Dialog
- **Title:** "Switch Tenant Partition"
- **Description:** "Enter a unique Tenant / User ID. IndexedDB tables, operation queues, Web Locks, and BroadcastChannels will isolate automatically."
- **Fields:** Text input for custom Tenant / User ID (placeholder: "e.g. user_789")
- **Buttons:**
  - **Cancel** — closes dialog
  - **Switch** (contained) — applies the custom user ID and switches tenant

### 10.2 Vault Encryption Passphrase Dialog
- **Title:** "At-Rest Vault Encryption (Web Crypto)" with Shield icon
- **Description:** Explains AES-GCM-256 envelope encryption with PBKDF2 (100,000 iterations)
- **Fields:** Password input for "Encryption Passphrase / PIN"
  - Helper text (when encrypted): "Vault is currently active. Change passphrase or leave blank to disable."
  - Helper text (when not encrypted): "Enter a master passphrase to enable at-rest envelope encryption."
- **Buttons:**
  - **Disable Encryption** (error red, left-aligned) — only visible when vault is active; clears passphrase
  - **Cancel** — closes dialog
  - **Save Vault Key** (contained) — applies the passphrase, re-instantiates SDK client with encryption

### 10.3 Prune Cache Dialog
- **Title:** "Prune Local Cache"
- **Description:** "Keep only the newest records in local IndexedDB. Oldest records will be evicted. Records with pending unsynced operations will be safely preserved."
- **Fields:** Number input for "Max Records to Keep" (default: 5, min: 0)
- **Buttons:**
  - **Cancel** — closes dialog
  - **Prune to X** (secondary/purple, contained) — executes `sdk.cache.prune('tasks', maxRecords)`

### 10.4 Clear Cache Dialog
- **Title:** "Clear Local Cache"
- **Description:** "Clear all cached tasks from local IndexedDB? Pending unsynced operations in the ops queue will NOT be deleted."
- **Buttons:**
  - **Cancel** — closes dialog
  - **Clear Cache** (warning/orange, contained) — executes `sdk.cache.clear('tasks')`

### 10.5 Clock Skew Simulator Dialog
- **Title:** "Clock Skew Simulator & Calibration" with Clock icon
- **Description:** Explains NTP-lite RTT calibration and monotonic causality guarantees
- **Fields:** Number input for "Simulated Clock Offset (ms)"
  - Helper text: "Positive = device clock ahead; Negative = device clock behind server"
- **Preset Buttons:**
  - **-10s Past** — sets offset to -10000ms
  - **+5s Ahead** — sets offset to +5000ms
  - **+60s Future** — sets offset to +60000ms
  - **0 (Reset)** — resets offset to 0
- **Buttons:**
  - **Cancel** — closes dialog
  - **Apply Offset** (contained) — applies the clock offset via `sdk.setClockOffset(offsetMs)`

### 10.6 Schema Versioning & Migration Dialog
- **Title:** "Schema Versioning & Migrations" with DynamicFeed icon
- **Description:** Shows current domain schema version (e.g., "v1")
- **Migration Buttons:**
  - **Run Migration to v2 (Ensure tags & points defaults)** — transforms IndexedDB records: ensures `tags` is array, `points` is numeric
  - **Run Migration to v3 (Normalize status & assignee)** — transforms records: lowercases `status`, adds default assignee "Unassigned"
  - **Simulate Server Drift (Set Server Schema to v2)** (warning/orange) — sends `POST /api/tasks/config/schema-version` to set server to v2, then triggers sync to detect drift
- **Buttons:**
  - **Close** — closes dialog

### 10.7 Dead-Letter Queue (DLQ) Dialog
- **Title:** "Dead-Letter Queue (Quarantined Operations)" with Warning icon
- **Description:** "Operations that encountered permanent non-retryable client errors (e.g. 400, 422, 403) are quarantined here after exceeding failure thresholds to prevent poison pill loops."
- **Content:** Table listing quarantined operations:

| Column | Description |
|--------|-------------|
| **Type** | Operation type chip (create/update/delete) |
| **Task ID** | Associated task ID |
| **Error / Detail** | Error message (in red) |
| **Action** | **Retry** button (outlined, primary) — re-queues the op for next sync |

- **Buttons:**
  - **Discard All (N)** (error red, outlined) — permanently discards all DLQ operations
  - **Close** — closes dialog

### 10.8 Clear Log Confirmation Dialog
- **Title:** "Clear '[tab name]'?"
- **Buttons:**
  - **Cancel** — closes dialog
  - **Clear** (error red, contained) — deletes all data from the specified log tab

---

## 11. Dual-Mode Architecture (SDK vs. Direct Fetch)

The application operates in two distinct modes, toggled via the SDK switch in the TopBar:

### SDK Mode (`with-library`) — Full `offline-sync-lite@0.4.0`

| Feature | Behavior |
|---------|----------|
| **Local Storage** | IndexedDB (per-tenant isolated databases) |
| **Offline Support** | Full — tasks created offline are queued |
| **Operation Queue** | Pending ops stored in IndexedDB, drained on reconnect |
| **Encryption** | AES-GCM-256 with PBKDF2 |
| **Multi-Tab** | Web Locks leader election + BroadcastChannel |
| **Conflict Resolution** | Field-level merge (tags: union, points: max) |
| **Schema Migrations** | Stepwise v1 to v2 to v3 |
| **Dead-Letter Queue** | Quarantine for permanent failures |
| **Cache Management** | LRU prune, clear |
| **Clock Calibration** | NTP-lite + monotonic clock |

### Baseline Mode (`without-library`) — Direct Fetch

| Feature | Behavior |
|---------|----------|
| **Local Storage** | In-memory array only |
| **Offline Support** | None — requires server connectivity |
| **Operation Queue** | None |
| **Encryption** | Not supported |
| **Multi-Tab** | No coordination |
| **Conflict Resolution** | Server-side only (last-write-wins) |
| **Schema Migrations** | Not supported |
| **Dead-Letter Queue** | Errors fail immediately |
| **Cache Management** | Memory-only clear |
| **Clock Calibration** | Not supported |

---

## 12. 10 Core Architectural Features

### Feature 1: Multi-User Tenant Isolation & Account Switching
- **UI Control:** User dropdown in TopBar
- **SDK Method:** `client.switchUser(newUserId, options)`
- **Storage Isolation:** IndexedDB databases named `offline-sync-lite:[userId]`
- **Purge:** `client.purge()` destroys tenant-specific IndexedDB on sign-out

### Feature 2: At-Rest Web Crypto AES-GCM-256 Envelope Encryption
- **UI Control:** Vault badge chip in TopBar -> Vault Dialog
- **SDK Config:** `encryption: { passphrase }` with PBKDF2 100,000 iterations
- **Protection:** Encrypts IndexedDB records and queued mutation payloads

### Feature 3: Field-Level Conflict Merging & Custom Resolvers
- **SDK Config:** `createFieldMergeResolver({ deep: true, strategies: { tags: 'union', points: 'max' } })`
- **Behavior:** When User A changes `tags` and User B changes `points` offline, both fields are cleanly merged upon reconnect

### Feature 4: Multi-Tab Concurrency & Web Locks
- **UI Control:** "2nd Tab" button in TopBar
- **SDK Config:** `enableTabCoordination: true`
- **Leader Election:** `navigator.locks` prevents duplicate concurrent network pushes
- **Cross-Tab Reactivity:** `BroadcastChannel` updates all tabs in real-time

### Feature 5: Clock Skew Mitigation & Monotonic Causality
- **UI Control:** Clock button in Sync Monitor -> Clock Skew Dialog
- **SDK Feature:** Passive NTP-Lite calibration via server `Date` headers
- **Guarantee:** Monotonic sequence clock preserves causality even with skewed device clocks

### Feature 6: Domain Schema Versioning & At-Rest Migrations
- **UI Control:** Schema button in Sync Monitor -> Schema Dialog
- **Migrations:** v1 to v2 (tags/points formatting), v2 to v3 (status normalization)
- **Drift Detection:** `x-schema-version` header comparison triggers notifications

### Feature 7: Poison Pill Protection & Dead-Letter Queue (DLQ)
- **UI Control:** Poison Pill button in Sync Monitor + DLQ button
- **Behavior:** 4xx errors (400, 422, 403) quarantine operations after failure threshold
- **Management:** Retry individual ops or discard all from DLQ dialog

### Feature 8: Cache Eviction & Storage Management
- **UI Controls:** Prune Cache + Clear Cache buttons in Sync Monitor
- **SDK Config:** `cacheLimits: { tasks: 50 }`
- **Safety:** Prune/clear preserves unsynced operation queues

### Feature 9: Auto-Sync & Dynamic Online/Offline Reconnect
- **UI Controls:** Auto Play / Auto Stop / Pause / Resume buttons
- **SDK Config:** `syncIntervalMs: 15000` (15 seconds)
- **Reconnect:** Automatic queue draining on `window.online` event

### Feature 10: High-Throughput REST API & Atomic Batch Endpoint
- **Endpoint:** `POST /api/tasks/batch`
- **Behavior:** Accepts array of `{ type, id, payload }` operations for atomic sync

---

## 13. REST API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/tasks` | List tasks (supports `?since=ISO` incremental sync and `?userId=tenant` filter) |
| `POST` | `/api/tasks` | Create a task (requires `id` and `title`; accepts `description`, `status`, `priority`, `assignee`, `tags`, `points`, `userId`) |
| `GET` | `/api/tasks/:id` | Fetch single task by ID |
| `PATCH` | `/api/tasks/:id` | Update task fields (with optimistic concurrency `updatedAt` check — returns 409 on conflict) |
| `DELETE` | `/api/tasks/:id` | Delete task by ID |
| `POST` | `/api/tasks/batch` | Atomic batch sync endpoint — array of `{ type, id, payload }` operations |
| `GET` | `/api/tasks/config/schema-version` | Get current server schema version |
| `POST` | `/api/tasks/config/schema-version` | Set server schema version (for drift simulation) |
| `POST` | `/api/tasks/config/seed` | Seed demo data for Alice and Bob (4 tasks) |

### Response Headers

| Header | Purpose |
|--------|---------|
| `x-schema-version` | Current server domain schema version number |
| `Date` | Server UTC timestamp for NTP-lite clock calibration |

### Error Codes

| Code | Meaning |
|------|---------|
| `400` | Bad request (missing required fields) |
| `404` | Task not found |
| `409` | Conflict (optimistic concurrency violation) |
| `422` | Unprocessable Entity (poison pill validation failure) |
| `500` | Internal server error |

---

## 14. Research Benchmark Scenarios (S1-S10)

| ID | Name | Primary Objective |
|----|------|-------------------|
| **S1** | Offline Create & Reconnect | Create tasks while offline, verify local availability, reconnect online, confirm queue drains |
| **S2** | Rapid Repeated Update & Coalescing | Edit the same task 10 times offline; verify queue coalesces mutations |
| **S3** | Temporary Server Failure & Backoff | Stop backend; verify exponential backoff and retry counters without data loss |
| **S4** | Concurrent Edit Conflict & Field Merge | Edit different fields concurrently in two tabs; verify `tags: union` and `points: max` merge |
| **S5** | Poison Pill 4xx & Dead-Letter Queue | Inject invalid mutation; verify 422 quarantine into DLQ without blocking queue |
| **S6** | Multi-Tab Concurrency & Web Locks | Open 2 tabs; perform simultaneous edits; verify `navigator.locks` leader election |
| **S7** | Multi-User Tenant Isolation | Switch Alice to Bob; verify separate IndexedDB and zero data bleed |
| **S8** | At-Rest Vault Encryption | Set vault passphrase; inspect IndexedDB for AES-GCM-256 ciphertext |
| **S9** | Domain Schema Versioning & Migration | Advance to v2/v3; verify stepwise record transformation and drift alerts |
| **S10** | Clock Skew Mitigation & Monotonicity | Skew clock by +/-60s; verify causality-preserving timestamps |

---

## 15. Complete Test Case Guide

### How to Execute a Benchmark Test

1. **Select Scenario** — Choose S1-S10 from the Scenario dropdown in the Sync Monitor Panel
2. **Start Run** — Click the green **Start Run** button
3. **Execute Steps** — Follow the detailed steps for each test case below
4. **End Run** — Click the red **End Run** button (auto-runs consistency check)
5. **Review Results** — Check all 4 data tabs (Sync Cycle Log, Run Summary, Event Log, Consistency Check)
6. **Export Data** — Click **Export CSV** for single-tab or **Export Excel** for complete 4-sheet workbook

---

### TC-S1: Offline Create & Reconnect

| Field | Value |
|-------|-------|
| **Scenario** | S1 |
| **Objective** | Verify that tasks created while offline are stored locally and sync to the server upon reconnection |
| **Preconditions** | App is running in SDK mode, backend is running, browser is online |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set mode to SDK (toggle ON) | Mode chip shows "SDK v0.4.0" |
| 2 | Select scenario **S1** from dropdown | Scenario label updates to "S1 — Offline Create & Reconnect" |
| 3 | Click **Start Run** | Run active chip appears with run ID; Event Log shows `run_start` |
| 4 | Open browser DevTools - Network - check "Offline" checkbox | Online chip changes to red "Offline" |
| 5 | Click **Add Task** in TopBar | Navigate to Create Task page |
| 6 | Fill in: Title = "Offline Task Alpha", Status = "open", Priority = "high" | Form populated |
| 7 | Click **Create Task** | Task is saved to local IndexedDB; snackbar shows "Task created successfully!" |
| 8 | Navigate back to `/tasks` | Task card appears in the grid with title "Offline Task Alpha" |
| 9 | Check Sync Monitor - Queued metric | Should show `1` (one pending operation in queue) |
| 10 | Uncheck "Offline" in DevTools | Online chip changes to green "Online" |
| 11 | Click **Sync Now** | Sync cycle executes; queued op pushed to server; Queued metric returns to `0` |
| 12 | Click **End Run** | Run summary generated; consistency check auto-runs |
| 13 | Check **Consistency Check** tab | All tasks should show `is_consistent: yes` |
| 14 | Check **Run Summary** tab | `final_consistency` should be `yes`, `queue_drain_time_s` should have a valid value |

**Pass Criteria:**
- Task persisted locally while offline
- Task visible in grid before reconnection
- Queue drained successfully after going online
- Server and local state consistent after sync
- No data loss (lost_ops_count = 0)

---

### TC-S2: Rapid Repeated Update & Coalescing

| Field | Value |
|-------|-------|
| **Scenario** | S2 |
| **Objective** | Verify that multiple rapid updates to the same task while offline are coalesced into minimal operations |
| **Preconditions** | At least one task exists, SDK mode active |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S2**, click **Start Run** | Run starts |
| 2 | Go offline (DevTools - Network - Offline) | Status changes to "Offline" |
| 3 | Click **Edit** on an existing task | Navigate to edit page |
| 4 | Change the title, click **Update Task** | Task updated locally, queued |
| 5 | Repeat Step 3-4 nine more times (10 edits total), changing different fields each time (description, priority, status, points, etc.) | Each edit queued locally |
| 6 | Check Sync Monitor - Queued metric | Should show queued ops (may be coalesced to fewer than 10) |
| 7 | Go back online | Online status restored |
| 8 | Click **Sync Now** | Queue drains, operations pushed to server |
| 9 | Click **End Run** | Run summary generated |

**Pass Criteria:**
- All 10 updates applied to local state immediately
- Queue coalesced mutations (pushed_ops ideally fewer than 10)
- Final task state on server reflects all 10 edits
- Consistency check passes

---

### TC-S3: Temporary Server Failure & Backoff

| Field | Value |
|-------|-------|
| **Scenario** | S3 |
| **Objective** | Verify exponential backoff retry logic and data preservation during server outage |
| **Preconditions** | SDK mode active, backend running |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S3**, click **Start Run** | Run starts |
| 2 | Create a new task while online | Task created and synced |
| 3 | **Stop the backend server** (Ctrl+C in terminal) | Server goes down |
| 4 | Click **Sync Now** | Sync fails; Event Log shows `sync_error`; Retries metric increments |
| 5 | Click **Sync Now** multiple times | Each attempt fails; retry count increases; observe exponential backoff delays |
| 6 | Check Sync Cycle Log tab | Multiple cycles with `success: no`, increasing `retries_cycle` |
| 7 | **Restart the backend server** (`npm run dev`) | Server comes back online |
| 8 | Click **Sync Now** | Sync succeeds; queued ops pushed; Cycle Log shows `success: yes` |
| 9 | Click **End Run** | Run summary shows retry_count_total > 0, final_consistency should be `yes` |

**Pass Criteria:**
- Sync errors logged with proper error codes
- Retry counter increments on each failure
- No data loss during server outage
- Recovery succeeds when server returns
- Operations queued offline are not lost

---

### TC-S4: Concurrent Edit Conflict & Field Merge

| Field | Value |
|-------|-------|
| **Scenario** | S4 |
| **Objective** | Verify field-level merge resolution (tags: union, points: max) when concurrent edits occur |
| **Preconditions** | At least one task exists, SDK mode active |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S4**, click **Start Run** | Run starts |
| 2 | Click **2nd Tab** in TopBar | New browser tab opens with the same app |
| 3 | In **Tab 1**: Edit a task, add tag `#urgent`, set points to `5`, save | Task updated locally |
| 4 | In **Tab 2**: Edit the **same** task, add tag `#security`, set points to `8`, save | Task updated locally in Tab 2 |
| 5 | In **Tab 1**: Click **Sync Now** | Tab 1 pushes its changes to server |
| 6 | In **Tab 2**: Click **Sync Now** | Conflict detected and resolved via field-level merge |
| 7 | Check Event Log | Should show `conflict` event with "Field-level conflict resolved" |
| 8 | Check the task in both tabs | Tags should include BOTH `#urgent` AND `#security` (union); Points should be `8` (max) |
| 9 | Click **End Run** | Run summary shows `conflict_count_total >= 1` |

**Pass Criteria:**
- Tags merged via union strategy (both tags present)
- Points resolved via max strategy (higher value wins)
- No lost updates — both users' changes preserved
- Conflict events logged with severity `warn`

---

### TC-S5: Poison Pill 4xx & Dead-Letter Queue (DLQ)

| Field | Value |
|-------|-------|
| **Scenario** | S5 |
| **Objective** | Verify that non-retryable 422 errors quarantine operations into the DLQ without blocking the rest of the queue |
| **Preconditions** | SDK mode active, backend running |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S5**, click **Start Run** | Run starts |
| 2 | Click **Poison Pill** button in Sync Monitor control bar | Poison pill task injected; Event Log shows `poison_pill_injected` |
| 3 | Click **Sync Now** | Sync cycle runs; 422 error received for poison pill op |
| 4 | Check Event Log | Should show `op_dead_letter` event with severity `error` |
| 5 | Check DLQ metric badge | Should show count >= 1 |
| 6 | Create a **normal** task (without poison pill) | Normal task created |
| 7 | Click **Sync Now** | Normal task syncs successfully; poison pill remains in DLQ |
| 8 | Click **DLQ** button in control bar | DLQ Dialog opens showing quarantined operations |
| 9 | Click **Retry** on a DLQ operation | Operation re-queued; will fail again on next sync (422 is permanent) |
| 10 | Click **Discard All** in DLQ Dialog | All quarantined ops permanently deleted |
| 11 | Click **End Run** | Run summary shows `final_consistency` |

**Alternative — Using Task Form:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| A1 | Click **Add Task** | Navigate to create page |
| A2 | Fill title, check **Simulate Poison Pill** checkbox | Checkbox turns red, submit button changes to "Inject Poison Pill" |
| A3 | Click **Inject Poison Pill** | Task queued locally with `poisonPill: true` |
| A4 | Click **Sync Now** | Server rejects with 422; op quarantined to DLQ |

**Pass Criteria:**
- Poison pill triggers 422 on server
- Operation quarantined to DLQ after failure threshold
- Subsequent normal operations sync successfully (queue not blocked)
- DLQ dialog shows quarantined operations with error details
- Retry and Discard actions work correctly

---

### TC-S6: Multi-Tab Concurrency & Web Locks

| Field | Value |
|-------|-------|
| **Scenario** | S6 |
| **Objective** | Verify Web Locks leader election and BroadcastChannel cross-tab sync |
| **Preconditions** | SDK mode active, backend running |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S6**, click **Start Run** | Run starts |
| 2 | Click **2nd Tab** button in TopBar | Second browser tab opens |
| 3 | Arrange both tabs side-by-side | Both visible simultaneously |
| 4 | In **Tab 1**: Create a new task | Task appears in Tab 1 |
| 5 | Observe **Tab 2** | Task should automatically appear in Tab 2 via BroadcastChannel |
| 6 | In both tabs simultaneously: Click **Sync Now** | One tab acquires the Web Lock and syncs; the other shows `sync_skipped` |
| 7 | Check Event Log in both tabs | One tab shows normal sync; the other shows "Sync skipped: Web Lock held by another tab" |
| 8 | In **Tab 2**: Delete a task | Task removed from Tab 2 |
| 9 | Observe **Tab 1** | Task should automatically disappear from Tab 1's grid |
| 10 | Click **End Run** | Run summary generated |

**Pass Criteria:**
- BroadcastChannel propagates changes across tabs in real-time
- Web Lock prevents duplicate concurrent sync pushes
- `sync_skipped` event logged when lock is held
- Both tabs remain in consistent state

---

### TC-S7: Multi-User Tenant Isolation & Account Switching

| Field | Value |
|-------|-------|
| **Scenario** | S7 |
| **Objective** | Verify complete data isolation between tenant partitions |
| **Preconditions** | SDK mode active, backend running, demo data seeded |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Seed** button in TopBar | Demo data seeded for Alice and Bob |
| 2 | Select scenario **S7**, click **Start Run** | Run starts |
| 3 | Ensure current user is **Alice** | TopBar shows "User: alice" |
| 4 | Observe task grid | Only Alice's tasks visible (seed-task-1, seed-task-2) |
| 5 | Click **User: alice** dropdown | User menu opens |
| 6 | Select **Bob (Tenant B)** | User switches to Bob |
| 7 | Observe task grid | Only Bob's tasks visible (seed-task-3, seed-task-4); Alice's tasks NOT visible |
| 8 | Check Sync Monitor - IDB name | Should show `offline-sync-lite:bob` |
| 9 | Check Event Log | Should show `user_switched` event: "switched from 'alice' to 'bob'" |
| 10 | Create a task as Bob | Task created with `userId: bob` |
| 11 | Switch back to Alice | Only Alice's original tasks visible; Bob's new task NOT visible |
| 12 | Click **End Run** | Run summary generated |

**With Purge on Switch:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| P1 | Check **"Purge old DB on switch"** checkbox in user menu | Checkbox enabled |
| P2 | Switch from Alice to Bob | Alice's IndexedDB database is destroyed |
| P3 | Event Log shows `purged` event | "Database offline-sync-lite:alice purged" |
| P4 | Switch back to Alice | Alice starts fresh — no local data until synced |

**Pass Criteria:**
- Zero data bleed between tenants
- Each tenant has isolated IndexedDB database
- User switch event logged properly
- Purge option destroys previous tenant's data

---

### TC-S8: At-Rest Vault Encryption (AES-GCM-256)

| Field | Value |
|-------|-------|
| **Scenario** | S8 |
| **Objective** | Verify IndexedDB records are encrypted when vault passphrase is set |
| **Preconditions** | SDK mode active, at least one task exists |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S8**, click **Start Run** | Run starts |
| 2 | Confirm vault is currently **Plain** | TopBar shows "Vault: Plain" chip (outlined, grey) |
| 3 | Click the **Vault: Plain** chip | Vault Dialog opens |
| 4 | Enter passphrase: `mySecretKey123` | Passphrase field populated |
| 5 | Click **Save Vault Key** | Dialog closes; chip changes to green "Vault: AES-256" with lock icon; snackbar: "Vault encryption enabled" |
| 6 | Event Log shows `encryption_change` | "AES-GCM-256 Vault Encryption Enabled" |
| 7 | Open browser DevTools - Application - IndexedDB - `offline-sync-lite:[user]` | Records should contain ciphertext (encrypted binary data), not plaintext JSON |
| 8 | Click **Sync Now** | Data remains accessible through SDK (transparent decryption) |
| 9 | Verify tasks are still displayed correctly | All task data readable (SDK handles decryption) |
| 10 | Click **Vault: AES-256** chip again | Dialog opens with "Vault is currently active" helper text |
| 11 | Click **Disable Encryption** (red button) | Encryption disabled; chip returns to "Vault: Plain" |
| 12 | Click **End Run** | Run summary generated |

**Pass Criteria:**
- Vault chip status correctly reflects encryption state
- IndexedDB data is encrypted (ciphertext visible in DevTools)
- Application functions normally with encryption enabled (transparent decrypt)
- Encryption can be enabled and disabled dynamically
- Event logged for encryption changes

---

### TC-S9: Domain Schema Versioning & Migration

| Field | Value |
|-------|-------|
| **Scenario** | S9 |
| **Objective** | Verify stepwise schema migrations and server drift detection |
| **Preconditions** | SDK mode active, tasks exist, current schema at v1 |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S9**, click **Start Run** | Run starts |
| 2 | Click **Schema v1** button in Sync Monitor | Schema Dialog opens showing "Current domain schema: v1" |
| 3 | Click **Run Migration to v2** | Dialog closes; migration runs; Event Log shows `schema_migrated`: "v1 to v2" |
| 4 | Verify tasks | All tasks should have tags as arrays and points as numbers (normalized by v2 migration) |
| 5 | Click **Schema v2** button | Dialog opens showing "v2" |
| 6 | Click **Run Migration to v3** | Migration runs; Event Log shows `schema_migrated`: "v2 to v3" |
| 7 | Verify tasks | All statuses lowercase; empty assignees now show "Unassigned" |
| 8 | Click **Schema v3** button, click **Simulate Server Drift (Set Server Schema to v2)** | Server schema set to v2; sync triggered |
| 9 | Check Event Log | Should show `schema_drift` event: "server schema version newer exceeds client version" |
| 10 | Click **End Run** | Run summary generated |

**Pass Criteria:**
- v2 migration normalizes tags to arrays and points to numbers
- v3 migration lowercases status and adds default assignee
- Migrations are stepwise (v1 to v2, then v2 to v3)
- Schema drift detection triggers notification events
- Migration events logged with record counts

---

### TC-S10: Clock Skew Mitigation & Monotonicity

| Field | Value |
|-------|-------|
| **Scenario** | S10 |
| **Objective** | Verify that timestamps remain causally ordered even with artificial clock drift |
| **Preconditions** | SDK mode active, backend running |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select scenario **S10**, click **Start Run** | Run starts |
| 2 | Click **Clock (0ms)** button in Sync Monitor | Clock Skew Dialog opens |
| 3 | Click **+60s Future** preset | Input shows 60000ms |
| 4 | Click **Apply Offset** | Dialog closes; Clock Skew metric shows "60000 ms" (orange); Event Log shows `clock_calibrated` |
| 5 | Create a new task | Task created with skewed clock offset |
| 6 | Click **Sync Now** | Sync cycle runs with skewed clock |
| 7 | Check task's `updatedAt` timestamp | Should reflect server-calibrated time, not the raw skewed client time |
| 8 | Click **Clock (60000ms)** button again | Dialog opens |
| 9 | Click **-10s Past** preset | Input shows -10000ms |
| 10 | Click **Apply Offset** | Clock offset changed to -10000ms |
| 11 | Create another task and sync | Task synced; monotonic ordering preserved |
| 12 | Reset clock: Click **0 (Reset)** then **Apply Offset** | Clock Skew metric returns to "0 ms" |
| 13 | Click **End Run** | Run summary generated |

**Pass Criteria:**
- Clock offset applied successfully (metric reflects change)
- Timestamps remain causally ordered despite clock drift
- NTP-lite calibration compensates for artificial skew
- Tasks sync correctly with extreme clock offsets
- Clock reset restores normal operation

---

### TC-FUNC-01: Create Task (Happy Path)

| Field | Value |
|-------|-------|
| **Category** | Functional |
| **Objective** | Verify complete task creation flow |

**Steps:**

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Add Task** in TopBar | Navigates to `/tasks/new`; page shows "Create New Task" heading |
| 2 | Enter Title: "Test Task" | Title field populated |
| 3 | Enter Description: "A test description" | Description populated |
| 4 | Set Status to "in-progress" | Dropdown shows "in-progress" |
| 5 | Set Priority to "high" | Dropdown shows "high" |
| 6 | Enter Assignee: "Tester" | Assignee populated |
| 7 | Set Story Points to 8 | Points field shows 8 |
| 8 | Add tags: type "testing" then press Enter; click `+ sync` quick tag | Tags show `#testing`, `#sync` |
| 9 | Click **Create Task** | Loading spinner appears, then snackbar "Task created successfully!" |
| 10 | Automatic redirect to `/tasks` (after 1 second) | New task card appears in grid with all entered data |

**Pass Criteria:**
- All fields correctly saved and displayed on card
- Tags displayed as purple chips
- Status chip shows correct color (orange for in-progress)
- Priority chip shows correct color (red for high)

---

### TC-FUNC-02: Create Task (Validation Error)

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/tasks/new` | Create page loads |
| 2 | Leave Title empty, click **Create Task** | Red error text appears: "Title is required" |
| 3 | Title field shows red error border | Form not submitted, no navigation |

---

### TC-FUNC-03: Edit Task

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Edit** on a task card | Navigates to `/tasks/[id]/edit`; form pre-filled with task data |
| 2 | Change Title to "Updated Title" | Title field updated |
| 3 | Remove a tag by clicking its x button | Tag removed from list |
| 4 | Click **Update Task** | Snackbar: "Task updated successfully!"; redirects to `/tasks` |
| 5 | Verify updated task card | Card shows new title; removed tag is gone |

---

### TC-FUNC-04: Delete Task

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Delete** (red) on a task card | Task removed from grid; snackbar: "Task deleted successfully" |
| 2 | Verify task is gone | Card no longer visible in grid |
| 3 | Click **Sync Now** (if SDK mode) | Delete operation synced to server |

---

### TC-FUNC-05: Seed Demo Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Seed** button in TopBar | Snackbar: "Demo tasks seeded for Alice & Bob" |
| 2 | Current user = Alice | Grid shows 2 Alice tasks |
| 3 | Switch to Bob | Grid shows 2 Bob tasks |

---

### TC-FUNC-06: Mode Switching

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Toggle SDK switch OFF | Mode chip changes to "Direct Fetch"; snackbar: "Switched mode to: Direct Fetch Baseline" |
| 2 | Vault chip, Prune, Clear Cache, DLQ, Clock, Schema, Poison Pill buttons disappear | SDK-only features hidden |
| 3 | Toggle SDK switch ON | All features reappear; mode restores to "SDK v0.4.0" |
| 4 | Hard refresh the browser | Mode persists (stored in localStorage) |

---

### TC-FUNC-07: Auto-Sync Controls

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click **Auto Play** | Event Log: "Auto-sync started (every 15s)"; sync fires every 15 seconds |
| 2 | Wait 15 seconds | Automatic sync cycle recorded in Cycle Log |
| 3 | Click **Pause** | Event Log: "Sync paused" (warning); auto-sync stops |
| 4 | Click **Resume** | Event Log: "Sync resumed"; auto-sync resumes + immediate sync |
| 5 | Click **Auto Stop** | Event Log: "Auto-sync stopped"; no more automatic syncs |

---

### TC-FUNC-08: Prune Cache

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have 10+ tasks in cache | Tasks visible in grid |
| 2 | Click **Prune Cache** button | Prune dialog opens |
| 3 | Set "Max Records to Keep" to 3 | Input shows 3 |
| 4 | Click **Prune to 3** | Snackbar: "Pruned X task(s), 3 remaining in cache"; Event Log shows `cache_pruned` |
| 5 | Verify grid | Only 3 most recent tasks visible |

---

### TC-FUNC-09: Clear Cache

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Have tasks in cache | Tasks visible in grid |
| 2 | Click **Clear Cache** button | Clear Cache dialog opens |
| 3 | Click **Clear Cache** (orange button) | Snackbar: "Local cache cleared (unsynced operations preserved)"; Event Log shows `cache_cleared` |
| 4 | Grid becomes empty | No tasks displayed |
| 5 | Click **Sync Now** | Tasks re-fetched from server and displayed again |

---

### TC-FUNC-10: Export Data

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Perform several syncs to populate data | Cycle logs, events populated |
| 2 | Select "Sync Cycle Log" tab | Table shows cycle data |
| 3 | Click **Export CSV** | Browser downloads `sync_cycle_log.csv` |
| 4 | Open CSV in spreadsheet app | All columns and data present |
| 5 | Click **Export Excel** (green button) | Browser downloads `sync_monitor_export.xlsx` |
| 6 | Open Excel file | 4 sheets present: "Sync Cycle Log", "Run Summary", "Event Log", "Consistency Check" |

---

### TC-FUNC-11: Clear Logs

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select a tab with data (e.g., "Event Log") | Table shows events |
| 2 | Click **Clear** (red outlined button) | Confirmation dialog: 'Clear "Event Log"?' |
| 3 | Click **Clear** (red contained button in dialog) | Tab data cleared; table shows "No events recorded yet." |

---

### TC-FUNC-12: Sync Monitor Collapse/Expand

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Click the collapse button (arrows right) | Panel shrinks to 56px; only "Sync" title visible |
| 2 | Click the expand button (arrows left) | Panel expands back to 640px with full controls |
| 3 | Drag the left border of the panel | Panel can be resized between 320px and 960px |

---

### TC-BASELINE-01: Baseline Mode Limitations

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Switch to Baseline mode (toggle OFF) | Mode = Direct Fetch |
| 2 | Go offline (DevTools) | Status changes to Offline |
| 3 | Try to create a task | Operation fails immediately (no offline queue) |
| 4 | Vault chip not visible | Vault only available in SDK mode |
| 5 | Prune Cache / Clear Cache / DLQ / Clock / Schema / Poison Pill buttons not visible | Buttons only available in SDK mode |
| 6 | Switch user from Alice to Bob | User switches but no IndexedDB isolation; server-side filter via `userId` query parameter |

**Pass Criteria:**
- Baseline mode correctly lacks offline support
- SDK-only UI elements hidden
- Baseline provides fair comparison benchmark

---

### TC-API-01: REST API Direct Testing

| Test | cURL Command | Expected |
|------|-------------|----------|
| List tasks | `curl http://localhost:4000/api/tasks` | `{ records: [...], serverTime, schemaVersion }` |
| List by user | `curl http://localhost:4000/api/tasks?userId=alice` | Only Alice's tasks |
| Incremental sync | `curl "http://localhost:4000/api/tasks?since=2026-01-01T00:00:00Z"` | Only tasks updated after the ISO timestamp |
| Create task | `curl -X POST http://localhost:4000/api/tasks -H "Content-Type: application/json" -d "{\"id\":\"test-1\",\"title\":\"API Test\",\"status\":\"open\",\"priority\":\"low\",\"userId\":\"alice\"}"` | 201 Created |
| Update task | `curl -X PATCH http://localhost:4000/api/tasks/test-1 -H "Content-Type: application/json" -d "{\"patch\":{\"title\":\"Updated API Test\"}}"` | 200 OK with updated record |
| Delete task | `curl -X DELETE http://localhost:4000/api/tasks/test-1` | `{ ok: true }` |
| Poison pill (422) | `curl -X POST http://localhost:4000/api/tasks -H "Content-Type: application/json" -d "{\"id\":\"poison-1\",\"title\":\"__POISON_PILL__\",\"userId\":\"alice\"}"` | 422 Unprocessable Entity |
| Seed data | `curl -X POST http://localhost:4000/api/tasks/config/seed` | `{ success: true, count: 4 }` |
| Schema version | `curl http://localhost:4000/api/tasks/config/schema-version` | `{ schemaVersion: 1, serverTime }` |
| Set schema version | `curl -X POST http://localhost:4000/api/tasks/config/schema-version -H "Content-Type: application/json" -d "{\"schemaVersion\":2}"` | `{ schemaVersion: 2 }` |

---

### TC-API-02: Batch Sync Endpoint

| Test | Description | Expected |
|------|-------------|----------|
| Batch create | POST `/api/tasks/batch` with `{"operations":[{"type":"create","id":"batch-1","payload":{"data":{"title":"Batch 1","status":"open","userId":"alice"}}},{"type":"create","id":"batch-2","payload":{"data":{"title":"Batch 2","status":"done","userId":"alice"}}}]}` | `{ results: [{ success: true }, { success: true }] }` |
| Batch with poison | Include a poison pill op in the batch | That specific result returns `{ success: false, status: 422 }` while others succeed |
| Batch update | `{"operations":[{"type":"update","id":"batch-1","payload":{"data":{"title":"Updated Batch"}}}]}` | `{ results: [{ success: true, record: {...} }] }` |
| Batch delete | `{"operations":[{"type":"delete","id":"batch-1"}]}` | `{ results: [{ success: true }] }` |

---

## Summary — Quick Reference of All Buttons

| Location | Button | Action |
|----------|--------|--------|
| TopBar | User: [id] dropdown | Open tenant selector menu |
| TopBar | Vault chip | Open encryption dialog |
| TopBar | 2nd Tab | Open duplicate tab |
| TopBar | Seed | Seed demo tasks |
| TopBar | SDK toggle | Switch between SDK and Direct Fetch |
| TopBar | Sync Now | Trigger manual sync |
| TopBar | Add Task | Navigate to create page |
| Task Card | Edit | Navigate to edit page |
| Task Card | Delete | Delete the task |
| Task Form | Cancel | Go back to task list |
| Task Form | Create/Update Task | Submit the form |
| Task Form | Inject Poison Pill | Submit with 422 trigger |
| Task Form | Add (tag) | Add a tag to the list |
| Task Form | Quick tag chips | Add suggested tag |
| Task Form | Tag x (delete) | Remove a tag |
| Sync Monitor | Start Run | Begin benchmark run |
| Sync Monitor | End Run | End benchmark run |
| Sync Monitor | Check | Run consistency check |
| Sync Monitor | Sync Now | Manual sync |
| Sync Monitor | Auto Play | Start auto-sync |
| Sync Monitor | Auto Stop | Stop auto-sync |
| Sync Monitor | Pause | Pause auto-sync |
| Sync Monitor | Resume | Resume auto-sync |
| Sync Monitor | Clock | Open clock skew dialog |
| Sync Monitor | Schema vX | Open schema dialog |
| Sync Monitor | Poison Pill | Inject poison pill op |
| Sync Monitor | Prune Cache | Open prune dialog |
| Sync Monitor | Clear Cache | Open clear cache dialog |
| Sync Monitor | DLQ | Open DLQ dialog |
| Sync Monitor | Clear | Clear current tab data |
| Sync Monitor | Export CSV | Export current tab as CSV |
| Sync Monitor | Export Excel | Export all tabs as Excel |
| Sync Monitor | Collapse/Expand | Collapse/expand panel |
| Dialogs | Cancel/Close | Dismiss dialog |
| Dialogs | Switch | Apply custom tenant |
| Dialogs | Save Vault Key | Apply encryption |
| Dialogs | Disable Encryption | Remove encryption |
| Dialogs | Prune to X | Execute cache prune |
| Dialogs | Clear Cache | Execute cache clear |
| Dialogs | Apply Offset | Set clock skew |
| Dialogs | -10s / +5s / +60s / Reset | Clock offset presets |
| Dialogs | Run Migration v2/v3 | Execute schema migration |
| Dialogs | Simulate Drift | Set server schema version |
| DLQ Dialog | Retry | Re-queue DLQ operation |
| DLQ Dialog | Discard All | Permanently discard all DLQ ops |

---

*End of Manual*
