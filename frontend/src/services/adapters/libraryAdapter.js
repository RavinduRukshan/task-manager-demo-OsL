'use client';

// ─── Library Adapter ──────────────────────────────────────────────────────────
// Uses offline-sync-lite for offline persistence, operation queueing, encryption,
// multi-tab coordination, field-level conflict merging, and schema migrations.

import { createSyncClient, createFieldMergeResolver } from 'offline-sync-lite';
import { generateRunId, loadLogs, saveLogs, nextId } from '../syncLogger';

const API_BASE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:4000';

// offline-sync-lite builds request URLs as: apiUrl + '/' + resourceName
// so the library's apiUrl must include the /api prefix.
const LIBRARY_API_URL = API_BASE_URL.replace(/\/$/, '') + '/api';

// ─── localStorage keys ────────────────────────────────────────────────────────

const ADAPTER_MODE = 'with_library';

const LS = {
  cycleLogs:       'lib_cycleLogs',
  runLogs:         'lib_runLogs',
  consistencyLogs: 'lib_consistencyLogs',
  eventIdCounter:  'lib_eventIdCounter',
  checkIdCounter:  'lib_checkIdCounter',
  repeatCounters:  'lib_repeatCounters',
  userId:          'lib_userId',
  passphrase:      'lib_passphrase',
};

// ─── Internal state ───────────────────────────────────────────────────────────

let _client         = null;
let _latestRecords  = [];
let _events         = [];                               // session-only (not persisted)
let _cycleLogs      = loadLogs(LS.cycleLogs,       []);
let _runLogs        = loadLogs(LS.runLogs,         []);
let _consistencyLogs = loadLogs(LS.consistencyLogs, []);
let _subscribers    = [];

let _userId         = typeof window !== 'undefined' ? (localStorage.getItem(LS.userId) || 'alice') : 'alice';
let _passphrase     = typeof window !== 'undefined' ? (localStorage.getItem(LS.passphrase) || '') : '';
let _schemaVersion  = 1;

// Cumulative sync stats (session)
let _syncSuccessCount  = 0;
let _syncFailCount     = 0;
let _latencySamples    = [];
let _retryCount        = 0;
let _conflictsDetected = 0;

// Current cycle
let _cycleHttpReqCount     = 0;
let _cyclePayloadSentBytes  = 0;
let _currentCycleId         = null;

// Scenario
let _scenarioId        = 'N/A';
let _userOpsInScenario = 0;

// Run lifecycle
let _runActive           = false;
let _currentRunId        = null;
let _runStartTs          = null;
let _runOnlineStart      = true;
let _currentCycleSeq     = 0;    // per-run sequential counter, resets on startRun
let _runRepeatCounters   = loadLogs(LS.repeatCounters, {});
let _runSyncSuccessCount = 0;
let _runSyncFailCount    = 0;
let _runTotalHttpReqs    = 0;
let _runTotalPayloadKB   = 0;
let _runLatencies        = [];
let _runConflicts        = 0;
let _runRetries          = 0;
let _runLostOps          = 0;
let _maxQueueDepthInRun  = 0;
let _firstNonZeroQueueTs = null;   // for queue_drain_time_s
let _queueDrainTs        = null;

// Auto-sync
let _autoSyncHandle = null;
let _paused         = false;

// ─── Domain Schema Migrations ─────────────────────────────────────────────────

const _migrations = {
  2: (data) => {
    // Step migration v1 -> v2: Ensure tags is an array, points is numeric, format title
    const tags = Array.isArray(data?.tags) ? data.tags : (data?.tags ? [data.tags] : []);
    const points = typeof data?.points === 'number' ? data.points : 0;
    return {
      ...data,
      tags,
      points,
      _migratedToV2: true,
    };
  },
  3: (data) => {
    // Step migration v2 -> v3: Normalize status to lowercase, add default assignee if missing
    return {
      ...data,
      status: (data?.status || 'open').toLowerCase(),
      assignee: data?.assignee || 'Unassigned',
      _migratedToV3: true,
    };
  },
};

// ─── Pub/sub ──────────────────────────────────────────────────────────────────

function _notifyAll() {
  const payload = {
    records:         [..._latestRecords],
    events:          [..._events],
    cycleLogs:       [..._cycleLogs],
    runLogs:         [..._runLogs],
    consistencyLogs: [..._consistencyLogs],
    runActive:       _runActive,
    currentRunId:    _currentRunId,
    userId:          _userId,
    dbName:          _client?.dbName || `offline-sync-lite:${_userId}`,
    schemaVersion:   _schemaVersion,
    encrypted:       Boolean(_passphrase),
  };
  for (const fn of _subscribers) {
    try { fn(payload); } catch (_) {}
  }
}

// ─── Event helpers ────────────────────────────────────────────────────────────

function _addEvent({ type, detail, task_id = null, severity = 'info' }) {
  const entry = {
    event_id:   nextId(LS.eventIdCounter),
    run_id:     _currentRunId,
    cycle_id:   _currentCycleId,
    event_ts:   new Date().toISOString(),
    event_type: type,
    task_id,
    severity,
    detail,
  };
  _events = [entry, ..._events].slice(0, 200);
  _notifyAll();
}

function _addCycleLog(entry) {
  _cycleLogs = [entry, ..._cycleLogs].slice(0, 50);
  saveLogs(LS.cycleLogs, _cycleLogs);
  _notifyAll();
}

function _countAppliedUpdates(prevRecords, nextRecords) {
  const prevById = new Map(prevRecords.map((item) => [item.id, item]));
  const nextById = new Map(nextRecords.map((item) => [item.id, item]));
  let changed = 0;

  for (const [id, next] of nextById) {
    const prev = prevById.get(id);
    if (!prev || prev.updatedAt !== next.updatedAt) changed++;
  }

  for (const id of prevById.keys()) {
    if (!nextById.has(id)) changed++;
  }

  return changed;
}

function _onLibraryEvent(evt) {
  switch (evt.type) {
    case 'conflict':
      _conflictsDetected++;
      _runConflicts++;
      _addEvent({
        type: 'conflict',
        detail: `Field-level conflict resolved on task ${evt.id || ''}`,
        task_id: evt.id,
        severity: 'warn',
      });
      break;
    case 'retry':
      _retryCount++;
      _runRetries++;
      _addEvent({
        type: 'op_retry',
        detail: `Retry attempt ${evt.attempt ?? ''} for ${evt.id ?? 'op'}`,
        task_id: evt.id,
        severity: 'warn',
      });
      break;
    case 'sync_error':
      _addEvent({ type: 'sync_error', detail: evt.error || '', severity: 'error' });
      break;
    case 'cache_pruned':
      _addEvent({
        type: 'cache_pruned',
        detail: `Auto-pruned ${evt.pruned} cached task${evt.pruned === 1 ? '' : 's'} (${evt.kept} kept)`,
        severity: 'info',
      });
      list().catch(() => {});
      break;
    case 'cache_cleared':
      _addEvent({
        type: 'cache_cleared',
        detail: 'Local cache cleared (unsynced ops preserved)',
        severity: 'info',
      });
      break;
    case 'op_dead_letter':
      _addEvent({
        type: 'op_dead_letter',
        detail: `Op ${evt.op?.type || ''} on task ${evt.op?.id || evt.id || ''} quarantined to DLQ: ${evt.error || ''}`,
        task_id: evt.op?.id || evt.id,
        severity: 'error',
      });
      break;
    case 'sync_skipped':
      _addEvent({
        type: 'sync_skipped',
        detail: `Sync skipped: ${evt.reason || 'Web Lock held by another tab'}`,
        severity: 'info',
      });
      break;
    case 'schema_drift':
      _addEvent({
        type: 'schema_drift',
        detail: `Schema drift detected: server schema version ${evt.serverVersion ?? 'newer'} exceeds client version ${evt.clientVersion ?? ''}`,
        severity: 'warn',
      });
      break;
    case 'schema_migrated':
      _addEvent({
        type: 'schema_migrated',
        detail: `Schema migrated: v${evt.fromVersion} → v${evt.toVersion} (${evt.recordsMigrated || 0} records, ${evt.opsMigrated || 0} ops)`,
        severity: 'info',
      });
      break;
    case 'user_switched':
      _addEvent({
        type: 'user_switched',
        detail: `User session switched from '${evt.previousUserId || 'anon'}' to '${evt.userId}' (DB: ${evt.dbName})`,
        severity: 'info',
      });
      break;
    case 'purged':
      _addEvent({
        type: 'purged',
        detail: `Database ${evt.dbName || ''} purged from browser for user ${evt.userId || ''}`,
        severity: 'warn',
      });
      break;
    case 'logout':
      _addEvent({
        type: 'logout',
        detail: `User ${evt.userId || ''} logged out (purged: ${evt.purged ? 'yes' : 'no'})`,
        severity: 'info',
      });
      break;
    case 'clock_calibrated':
      _addEvent({
        type: 'clock_calibrated',
        detail: `Clock calibrated: server offset ${evt.offsetMs ?? 0}ms`,
        severity: 'info',
      });
      break;
    default:
      break;
  }
}

function client() {
  if (typeof window === 'undefined') return null;
  if (!_client) {
    const resolver = createFieldMergeResolver({
      deep: true,
      strategies: {
        tags: 'union',
        points: 'max',
      },
    });

    _client = createSyncClient({
      apiUrl: LIBRARY_API_URL,
      resourceName: 'tasks',
      userId: _userId,
      encryption: _passphrase ? { passphrase: _passphrase } : null,
      syncIntervalMs: 15000,
      maxRetries: 3,
      maxPermanentFailures: 5,
      backoffBaseMs: 500,
      conflictResolver: resolver,
      enableTabCoordination: true,
      schemaVersion: _schemaVersion,
      migrations: _migrations,
      onSchemaDrift: 'notify',
      cacheLimits: {
        tasks: 50,
      },
      headers: () => ({
        'x-user-id': _userId,
      }),
      onEvent: _onLibraryEvent,
    });

    // Reactive subscriber fires on local IDB changes, cross-tab BroadcastChannel events, and remote pulls
    _client.subscribe((items) => {
      _latestRecords = items || [];
      _notifyAll();
    });
  }
  return _client;
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

async function _getQueuedOpsCount() {
  try {
    const sdk = client();
    if (sdk?.getMetrics) {
      const m = await sdk.getMetrics();
      return m.queuedOpsCount || 0;
    }
    return 0;
  } catch (_) {
    return 0;
  }
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function create(task) {
  const { id, ...fields } = task;
  const sdk = client();
  _userOpsInScenario++;
  const taskPayload = {
    id,
    ...fields,
    userId: fields.userId || _userId,
    tags: Array.isArray(fields.tags) ? fields.tags : [],
    points: typeof fields.points === 'number' ? fields.points : (parseInt(fields.points, 10) || 0),
  };
  const record = await sdk.create({ id, data: taskPayload });
  _addEvent({ type: 'op_success', detail: `Created/Queued task ${record.id}`, task_id: record.id });
  return record;
}

async function update(id, patch) {
  const sdk = client();
  _userOpsInScenario++;
  try {
    const record = await sdk.update(id, patch);
    _addEvent({ type: 'op_success', detail: `Updated/Queued task ${id}`, task_id: id });
    return record;
  } catch (err) {
    if (err.status === 409 || err.message?.includes('conflict')) {
      _conflictsDetected++;
      _runConflicts++;
      _addEvent({ type: 'conflict', detail: `Conflict on task ${id}`, task_id: id, severity: 'warn' });
    }
    throw err;
  }
}

async function remove(id) {
  const sdk = client();
  _userOpsInScenario++;
  await sdk.remove(id);
  _addEvent({ type: 'op_success', detail: `Deleted/Queued task ${id}`, task_id: id });
  return { ok: true };
}

async function get(id) {
  return client().get(id);
}

async function list() {
  const sdk = client();
  const start = Date.now();
  try {
    _cycleHttpReqCount++;
    const records = await sdk.list();
    const durationMs = Date.now() - start;
    _latestRecords = records || [];
    _syncSuccessCount++;
    _latencySamples = [..._latencySamples, durationMs].slice(-20);
    _addEvent({ type: 'sync_done', detail: `Pulled ${_latestRecords.length} records · ${durationMs}ms` });
    return _latestRecords;
  } catch (err) {
    _syncFailCount++;
    _retryCount++;
    _addEvent({ type: 'sync_error', detail: `List failed: ${err.message}`, severity: 'error' });
    return _latestRecords;
  }
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

async function syncNow(trigger = 'auto') {
  _currentCycleSeq++;
  _currentCycleId        = _currentCycleSeq;
  _cycleHttpReqCount     = 0;
  _cyclePayloadSentBytes = 0;
  const cycleStartTs     = new Date().toISOString();
  const start            = Date.now();
  const onlineBefore     = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const queueBefore      = await _getQueuedOpsCount();
  const retryCountBefore = _retryCount;
  const conflictCountBefore = _conflictsDetected;
  const beforeRecords    = [..._latestRecords];

  if (queueBefore > 0 && _firstNonZeroQueueTs === null) {
    _firstNonZeroQueueTs = Date.now();
  }
  if (queueBefore > _maxQueueDepthInRun) {
    _maxQueueDepthInRun = queueBefore;
  }

  _addEvent({ type: 'sync_start', detail: `Sync triggered (${trigger})` });

  try {
    _cycleHttpReqCount++;
    const syncResult = await client().syncNow();
    
    // Refresh local cache via SDK
    const nextRecords    = await client().list();
    const cycleEndTs     = new Date().toISOString();
    const durationMs     = Date.now() - start;
    const onlineAfter    = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const appliedUpdates = _countAppliedUpdates(beforeRecords, nextRecords);
    _latestRecords = nextRecords || [];
    _syncSuccessCount++;
    _runSyncSuccessCount++;
    _latencySamples = [..._latencySamples, durationMs].slice(-20);
    _runLatencies.push(durationMs);
    const queueAfter     = await _getQueuedOpsCount();
    
    const pushedOps = syncResult?.pushedOps ?? Math.max(0, queueBefore - queueAfter);
    const failedOps = syncResult?.failedOps ?? 0;

    const cyclePayloadKB = Math.round((_cyclePayloadSentBytes / 1024) * 100) / 100;
    _runTotalHttpReqs  += _cycleHttpReqCount;
    _runTotalPayloadKB += cyclePayloadKB;
    const retriesInCycle   = _retryCount - retryCountBefore;
    const conflictsInCycle = _conflictsDetected - conflictCountBefore;
    _runRetries += retriesInCycle;

    if (queueAfter === 0 && _firstNonZeroQueueTs !== null && _queueDrainTs === null) {
      _queueDrainTs = Date.now();
    }

    if (syncResult?.skipped) {
      _addEvent({ type: 'sync_skipped', detail: 'Sync skipped: Web Lock held by another tab' });
    } else {
      if (pushedOps > 0) {
        _addEvent({ type: 'sync_done', detail: `Pushed ~${pushedOps} queued op${pushedOps === 1 ? '' : 's'} to server` });
      }
      _addEvent({ type: 'sync_done', detail: `Synced ${_latestRecords.length} records · ${durationMs}ms` });
    }

    _addCycleLog({
      cycle_id:         _currentCycleSeq,
      run_id:           _currentRunId,
      scenario_id:      _scenarioId,
      mode:             ADAPTER_MODE,
      trigger,
      success:          syncResult?.ok !== false ? 'yes' : 'no',
      cycle_start_ts:   cycleStartTs,
      cycle_end_ts:     cycleEndTs,
      duration_ms:      durationMs,
      online_before:    onlineBefore ? 'yes' : 'no',
      online_after:     onlineAfter  ? 'yes' : 'no',
      queue_before:     queueBefore,
      queue_after:      queueAfter,
      pushed_ops:       pushedOps,
      failed_ops:       failedOps,
      applied_updates:  appliedUpdates,
      retries_cycle:    retriesInCycle,
      conflicts_cycle:  conflictsInCycle,
      http_req_cycle:   _cycleHttpReqCount,
      payload_kb_cycle: cyclePayloadKB,
      error_code:       syncResult?.error ? 'ERROR' : '',
      error_summary:    syncResult?.error || '',
    });
    _notifyAll();
    return { ok: syncResult?.ok !== false, pushedOps, failedOps, appliedUpdates, durationMs };
  } catch (err) {
    const cycleEndTs     = new Date().toISOString();
    const durationMs     = Date.now() - start;
    const onlineAfter    = typeof navigator !== 'undefined' ? navigator.onLine : true;
    _syncFailCount++;
    _runSyncFailCount++;
    _retryCount++;
    _runRetries++;
    const queueAfter     = await _getQueuedOpsCount();
    const cyclePayloadKB = Math.round((_cyclePayloadSentBytes / 1024) * 100) / 100;
    _runTotalHttpReqs  += _cycleHttpReqCount;
    _runTotalPayloadKB += cyclePayloadKB;
    const retriesInCycle   = _retryCount - retryCountBefore;
    const conflictsInCycle = _conflictsDetected - conflictCountBefore;

    _addEvent({ type: 'sync_error', detail: err.message, severity: 'error' });

    _addCycleLog({
      cycle_id:         _currentCycleSeq,
      run_id:           _currentRunId,
      scenario_id:      _scenarioId,
      mode:             ADAPTER_MODE,
      trigger,
      success:          'no',
      cycle_start_ts:   cycleStartTs,
      cycle_end_ts:     cycleEndTs,
      duration_ms:      durationMs,
      online_before:    onlineBefore ? 'yes' : 'no',
      online_after:     onlineAfter  ? 'yes' : 'no',
      queue_before:     queueBefore,
      queue_after:      queueAfter,
      pushed_ops:       0,
      failed_ops:       0,
      applied_updates:  0,
      retries_cycle:    retriesInCycle,
      conflicts_cycle:  conflictsInCycle,
      http_req_cycle:   _cycleHttpReqCount,
      payload_kb_cycle: cyclePayloadKB,
      error_code:       err.status ? String(err.status) : '',
      error_summary:    err.message || String(err),
    });
    return { ok: false, pushedOps: 0, failedOps: 0, appliedUpdates: 0, durationMs };
  }
}

async function getMetrics() {
  const sdk = client();
  let sdkMetrics = null;
  if (sdk?.getMetrics) {
    try { sdkMetrics = await sdk.getMetrics(); } catch (_) {}
  }
  const queuedOpsCount = sdkMetrics ? sdkMetrics.queuedOpsCount : await _getQueuedOpsCount();
  const deadLetteredOpsCount = sdkMetrics ? (sdkMetrics.deadLetteredOpsCount || 0) : 0;
  const total = _syncSuccessCount + _syncFailCount;
  return {
    syncSuccessRate: total === 0 ? 0 : Math.round((_syncSuccessCount / total) * 100),
    avgSyncLatencyMs:
      _latencySamples.length === 0
        ? 0
        : Math.round(_latencySamples.reduce((a, b) => a + b, 0) / _latencySamples.length),
    retryCount: _retryCount,
    queuedOpsCount,
    deadLetteredOpsCount,
    conflictsDetected: _conflictsDetected,
  };
}

// ─── Run lifecycle ────────────────────────────────────────────────────────────

function startRun(scenarioId) {
  if (_runActive) return;

  const key = `${scenarioId}_${ADAPTER_MODE}`;
  _runRepeatCounters[key] = (_runRepeatCounters[key] || 0) + 1;
  saveLogs(LS.repeatCounters, _runRepeatCounters);

  _scenarioId          = scenarioId;
  _userOpsInScenario   = 0;
  _currentRunId        = generateRunId(scenarioId, ADAPTER_MODE);
  _runStartTs          = new Date().toISOString();
  _runOnlineStart      = typeof navigator !== 'undefined' ? navigator.onLine : true;
  _currentCycleSeq     = 0;
  _currentCycleId      = null;
  _runSyncSuccessCount = 0;
  _runSyncFailCount    = 0;
  _runTotalHttpReqs    = 0;
  _runTotalPayloadKB   = 0;
  _runLatencies        = [];
  _runConflicts        = 0;
  _runRetries          = 0;
  _runLostOps          = 0;
  _maxQueueDepthInRun  = 0;
  _firstNonZeroQueueTs = null;
  _queueDrainTs        = null;
  _runActive           = true;

  _addEvent({ type: 'run_start', detail: `Run ${_currentRunId} started` });
}

async function endRun() {
  if (!_runActive || !_currentRunId) return;

  const runEndTs    = new Date().toISOString();
  const onlineEnd   = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const totalCycles = _runSyncSuccessCount + _runSyncFailCount;
  const avgLatency  = _runLatencies.length
    ? Math.round(_runLatencies.reduce((a, b) => a + b, 0) / _runLatencies.length)
    : 0;
  const successRate = totalCycles === 0
    ? 0
    : Math.round((_runSyncSuccessCount / totalCycles) * 100);
  const key = `${_scenarioId}_${ADAPTER_MODE}`;
  const drainTimeS = (_firstNonZeroQueueTs !== null && _queueDrainTs !== null)
    ? Math.round((_queueDrainTs - _firstNonZeroQueueTs) / 10) / 100
    : null;

  const runRow = {
    run_id:               _currentRunId,
    scenario_id:          _scenarioId,
    mode:                 ADAPTER_MODE,
    repeat_no:            _runRepeatCounters[key] || 1,
    run_start_ts:         _runStartTs,
    run_end_ts:           runEndTs,
    online_start:         _runOnlineStart ? 'yes' : 'no',
    online_end:           onlineEnd ? 'yes' : 'no',
    total_user_ops:       _userOpsInScenario,
    total_cycles:         totalCycles,
    http_requests_total:  _runTotalHttpReqs,
    payload_kb_total:     Math.round(_runTotalPayloadKB * 100) / 100,
    avg_response_ms:      avgLatency,
    sync_success_rate:    `${successRate}%`,
    avg_sync_latency_ms:  avgLatency,
    retry_count_total:    _runRetries,
    max_queue_depth:      _maxQueueDepthInRun,
    queue_drain_time_s:   drainTimeS,
    conflict_count_total: _runConflicts,
    lost_ops_count:       _runLostOps,
    final_consistency:    'pending',
    notes:                '',
  };

  const savedRunId = _currentRunId;
  _runActive      = false;
  _currentRunId   = null;
  _currentCycleId = null;

  _addEvent({ type: 'run_end', detail: `Run ended — ${totalCycles} cycle(s), ${successRate}% success` });

  _runLogs = [runRow, ..._runLogs];
  saveLogs(LS.runLogs, _runLogs);
  _notifyAll();

  const consistency = await checkConsistency(savedRunId);
  const allOk = consistency.length > 0 && consistency.every(r => r.is_consistent === 'yes');
  _runLogs = _runLogs.map(r =>
    r.run_id === savedRunId ? { ...r, final_consistency: allOk ? 'yes' : 'no' } : r
  );
  saveLogs(LS.runLogs, _runLogs);
  _notifyAll();
}

async function checkConsistency(runId) {
  const targetRunId = runId || _currentRunId || (_runLogs[0]?.run_id);
  if (!targetRunId) return [];

  const checkedTs = new Date().toISOString();
  let serverTasks = [];
  try {
    const url = _userId && _userId !== 'all'
      ? `${API_BASE_URL}/api/tasks?userId=${encodeURIComponent(_userId)}`
      : `${API_BASE_URL}/api/tasks`;
    const res = await fetch(url, {
      headers: { 'x-user-id': _userId },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    serverTasks = data.records || [];
  } catch (err) {
    _addEvent({ type: 'sync_error', detail: `Consistency check failed: ${err.message}`, severity: 'error' });
    return [];
  }

  const localMap  = new Map(_latestRecords.map(t => [t.id, t]));
  const serverMap = new Map(serverTasks.map(t => [t.id, t]));
  const allIds    = new Set([...localMap.keys(), ...serverMap.keys()]);
  const rows      = [];

  for (const taskId of allIds) {
    const local  = localMap.get(taskId)  || null;
    const server = serverMap.get(taskId) || null;
    let isConsistent  = 'yes';
    let mismatchType  = '';
    let mismatchDetail = '';

    if (!local && server) {
      isConsistent   = 'no';
      mismatchType   = 'missing_local';
      mismatchDetail = `Task ${taskId} exists on server but not in local cache`;
    } else if (local && !server) {
      isConsistent   = 'no';
      mismatchType   = 'missing_server';
      mismatchDetail = `Task ${taskId} exists locally but not on server`;
    } else if (local && server) {
      const localTs  = local.updatedAt  || local.updated_at  || '';
      const serverTs = server.updatedAt || server.updated_at || '';
      if (localTs !== serverTs) {
        isConsistent   = 'no';
        mismatchType   = 'field_mismatch';
        mismatchDetail = `updatedAt mismatch: local=${localTs}, server=${serverTs}`;
      }
    }

    rows.push({
      check_id:        nextId(LS.checkIdCounter),
      run_id:          targetRunId,
      checked_ts:      checkedTs,
      task_id:         taskId,
      expected_state:  server ? JSON.stringify(server) : '(absent)',
      local_state:     local  ? JSON.stringify(local)  : '(absent)',
      server_state:    server ? JSON.stringify(server) : '(absent)',
      is_consistent:   isConsistent,
      mismatch_type:   mismatchType,
      mismatch_detail: mismatchDetail,
    });
  }

  _consistencyLogs = [...rows, ..._consistencyLogs];
  saveLogs(LS.consistencyLogs, _consistencyLogs);
  _notifyAll();
  return rows;
}

// ─── Pub/sub ──────────────────────────────────────────────────────────────────

function subscribe(fn) {
  _subscribers.push(fn);
  fn({
    records:         [..._latestRecords],
    events:          [..._events],
    cycleLogs:       [..._cycleLogs],
    runLogs:         [..._runLogs],
    consistencyLogs: [..._consistencyLogs],
    runActive:       _runActive,
    currentRunId:    _currentRunId,
    userId:          _userId,
    dbName:          _client?.dbName || `offline-sync-lite:${_userId}`,
    schemaVersion:   _schemaVersion,
    encrypted:       Boolean(_passphrase),
  });
  return function unsubscribe() {
    _subscribers = _subscribers.filter(s => s !== fn);
  };
}

// ─── Auto-sync controls ───────────────────────────────────────────────────────

function startAutoSync(intervalMs = 15000) {
  if (_autoSyncHandle) return;
  _paused = false;
  _autoSyncHandle = setInterval(() => syncNow('auto'), intervalMs);
  _addEvent({ type: 'auto_sync_start', detail: `Auto-sync started (every ${intervalMs / 1000}s)` });
}

function stopAutoSync() {
  if (_autoSyncHandle) {
    clearInterval(_autoSyncHandle);
    _autoSyncHandle = null;
    _addEvent({ type: 'auto_sync_stop', detail: 'Auto-sync stopped' });
  }
}

function pauseSync() {
  if (_autoSyncHandle) {
    clearInterval(_autoSyncHandle);
    _autoSyncHandle = null;
    _paused = true;
    _addEvent({ type: 'pause', detail: 'Sync paused', severity: 'warn' });
  }
}

function resumeSync(intervalMs = 15000) {
  if (_paused) {
    _paused = false;
    _autoSyncHandle = setInterval(() => syncNow('auto'), intervalMs);
    _addEvent({ type: 'resume', detail: 'Sync resumed' });
    syncNow('online_resume').catch(() => {});
  }
}

function setScenarioId(id) {
  _scenarioId = id;
  _userOpsInScenario = 0;
}

function clearLogs(target) {
  if      (target === 'cycleLogs')        { _cycleLogs = [];        saveLogs(LS.cycleLogs, []); }
  else if (target === 'runLogs')          { _runLogs = [];          saveLogs(LS.runLogs, []); }
  else if (target === 'events')           { _events = []; }
  else if (target === 'consistencyLogs')  { _consistencyLogs = [];  saveLogs(LS.consistencyLogs, []); }
  _notifyAll();
}

async function pruneCache(maxRecords = 50) {
  const sdk = client();
  if (!sdk?.cache?.prune) return { pruned: 0, kept: _latestRecords.length };
  const result = await sdk.cache.prune('tasks', maxRecords);
  _addEvent({
    type: 'cache_pruned',
    detail: `Manually pruned ${result.pruned} task${result.pruned === 1 ? '' : 's'} (${result.kept} kept, max: ${maxRecords})`,
    severity: 'info',
  });
  const records = await sdk.list();
  _latestRecords = records || [];
  _notifyAll();
  return result;
}

async function clearCache() {
  const sdk = client();
  if (!sdk?.cache?.clear) return { ok: true };
  await sdk.cache.clear('tasks');
  _addEvent({
    type: 'cache_cleared',
    detail: 'Local cache cleared (unsynced ops preserved)',
    severity: 'info',
  });
  _latestRecords = [];
  _notifyAll();
  return { ok: true };
}

async function getDeadLetterOps() {
  const sdk = client();
  if (!sdk?.getDeadLetterOps) return [];
  return sdk.getDeadLetterOps();
}

async function retryDeadLetterOp(opKey) {
  const sdk = client();
  if (!sdk?.retryDeadLetterOp) return null;
  const result = await sdk.retryDeadLetterOp(opKey);
  _addEvent({
    type: 'dlq_retry',
    detail: `Re-queued dead-letter operation (key: ${opKey})`,
    severity: 'info',
  });
  _notifyAll();
  return result;
}

async function discardDeadLetterOps() {
  const sdk = client();
  if (!sdk?.discardDeadLetterOps) return { discarded: 0 };
  const result = await sdk.discardDeadLetterOps();
  _addEvent({
    type: 'dlq_discard',
    detail: `Discarded ${result.discarded} dead-letter operation(s)`,
    severity: 'info',
  });
  _notifyAll();
  return result;
}

// ─── Multi-User & Tenant Management ──────────────────────────────────────────

async function switchUser(newUserId, options = {}) {
  _userId = newUserId || 'default';
  if (typeof window !== 'undefined') {
    localStorage.setItem(LS.userId, _userId);
  }
  const sdk = client();
  if (sdk?.switchUser) {
    await sdk.switchUser(_userId, {
      purgeOldUser: options.purgeOldUser || false,
      encryption: _passphrase ? { passphrase: _passphrase } : null,
    });
    const records = await sdk.list().catch(() => []);
    _latestRecords = records || [];
  }
  _addEvent({
    type: 'user_switched',
    detail: `Switched active tenant to '${_userId}' (DB: ${sdk?.dbName || `offline-sync-lite:${_userId}`})`,
    severity: 'info',
  });
  _notifyAll();
  return { userId: _userId, dbName: sdk?.dbName || `offline-sync-lite:${_userId}` };
}

async function logout(options = {}) {
  const sdk = client();
  if (sdk?.logout) {
    await sdk.logout(options);
  }
  _latestRecords = [];
  _addEvent({
    type: 'logout',
    detail: `Logged out user '${_userId}' (purged: ${options.purgeData ? 'yes' : 'no'})`,
    severity: 'info',
  });
  _notifyAll();
}

async function purge() {
  const sdk = client();
  if (sdk?.purge) {
    await sdk.purge();
  }
  _latestRecords = [];
  _addEvent({
    type: 'purged',
    detail: `Purged active database for '${_userId}'`,
    severity: 'warn',
  });
  _notifyAll();
}

// ─── Encryption / Vault Management ───────────────────────────────────────────

async function setEncryptionPassphrase(passphrase) {
  _passphrase = passphrase || '';
  if (typeof window !== 'undefined') {
    if (_passphrase) localStorage.setItem(LS.passphrase, _passphrase);
    else localStorage.removeItem(LS.passphrase);
  }

  // Re-instantiate client with encryption configuration
  if (_client) {
    _client.destroy();
    _client = null;
  }
  const sdk = client();
  const records = await sdk.list().catch(() => []);
  _latestRecords = records || [];
  _addEvent({
    type: 'encryption_change',
    detail: _passphrase ? 'AES-GCM-256 Vault Encryption Enabled' : 'At-Rest Storage Encryption Disabled',
    severity: 'info',
  });
  _notifyAll();
  return { encrypted: Boolean(_passphrase) };
}

function getEncryptionStatus() {
  return {
    encrypted: Boolean(_passphrase),
    passphraseSet: Boolean(_passphrase),
    algorithm: 'AES-GCM-256 (PBKDF2)',
  };
}

// ─── Clock Skew & Calibration ─────────────────────────────────────────────────

function getClockOffset() {
  const sdk = client();
  if (!sdk?.getClockOffset) return 0;
  return sdk.getClockOffset();
}

async function setClockOffset(offsetMs) {
  const sdk = client();
  if (sdk?.setClockOffset) {
    await sdk.setClockOffset(offsetMs);
    _addEvent({
      type: 'clock_calibrated',
      detail: `Calibrated client clock skew offset to ${offsetMs}ms`,
      severity: 'info',
    });
    _notifyAll();
  }
}

// ─── Schema Versioning & Migrations ───────────────────────────────────────────

async function getSchemaVersion() {
  const sdk = client();
  if (!sdk?.getSchemaVersion) return _schemaVersion;
  return sdk.getSchemaVersion();
}

async function migrate(targetVer = 2) {
  const sdk = client();
  if (!sdk?.migrate) return { migrated: false };
  const result = await sdk.migrate(targetVer);
  _schemaVersion = targetVer;
  _addEvent({
    type: 'schema_migrated',
    detail: `Applied schema migration up to v${targetVer} (${result.recordsMigrated || 0} records updated)`,
    severity: 'info',
  });
  const records = await sdk.list().catch(() => []);
  _latestRecords = records || [];
  _notifyAll();
  return result;
}

function getActiveUserId() {
  return _userId;
}

function getDbName() {
  const sdk = client();
  return sdk?.dbName || `offline-sync-lite:${_userId}`;
}

// ─── Demo & Simulation Helpers ────────────────────────────────────────────────

async function seedDemoData() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/config/seed`, { method: 'POST' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await syncNow('seed');
    _addEvent({ type: 'seed', detail: 'Demo data seeded for Alice and Bob', severity: 'info' });
    return { ok: true };
  } catch (err) {
    _addEvent({ type: 'sync_error', detail: `Seed failed: ${err.message}`, severity: 'error' });
    throw err;
  }
}

async function triggerPoisonPill(title = '__POISON_PILL__') {
  const id = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `poison-${Date.now()}`;
  const poisonTask = {
    id,
    title,
    description: 'Test non-retryable 422 error for Dead-Letter Queue quarantine',
    status: 'open',
    priority: 'high',
    assignee: _userId,
    tags: ['poison-pill', 'dlq-test'],
    poisonPill: true,
  };
  const sdk = client();
  _userOpsInScenario++;
  const record = await sdk.create({ id, data: poisonTask });
  _addEvent({
    type: 'poison_pill_injected',
    detail: `Injected poison pill task ${id} — will fail with 422 and enter DLQ after failure threshold`,
    task_id: id,
    severity: 'warn',
  });
  return record;
}

async function simulateSchemaDrift(targetVersion = 2) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/config/schema-version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemaVersion: targetVersion }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _addEvent({
      type: 'schema_drift_simulated',
      detail: `Server schema version set to v${targetVersion}. Triggering sync to detect drift...`,
      severity: 'info',
    });
    await syncNow('drift_test');
  } catch (err) {
    _addEvent({ type: 'sync_error', detail: `Drift simulation failed: ${err.message}`, severity: 'error' });
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────

const libraryAdapter = {
  create,
  update,
  remove,
  get,
  list,
  syncNow,
  getMetrics,
  subscribe,
  startAutoSync,
  stopAutoSync,
  pauseSync,
  resumeSync,
  setScenarioId,
  startRun,
  endRun,
  checkConsistency,
  clearLogs,
  pruneCache,
  clearCache,
  getDeadLetterOps,
  retryDeadLetterOp,
  discardDeadLetterOps,
  switchUser,
  logout,
  purge,
  setEncryptionPassphrase,
  getEncryptionStatus,
  getClockOffset,
  setClockOffset,
  getSchemaVersion,
  migrate,
  getActiveUserId,
  getDbName,
  seedDemoData,
  triggerPoisonPill,
  simulateSchemaDrift,
};

export default libraryAdapter;
