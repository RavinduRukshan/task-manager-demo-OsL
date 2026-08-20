'use client';

// ─── Baseline Adapter ─────────────────────────────────────────────────────────
// Pure fetch implementation — no offline-sync-lite dependency.
// Used in "Without Library" mode to provide a direct comparison baseline.

import { generateRunId, loadLogs, saveLogs, nextId } from '../syncLogger';

const API_BASE_URL =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : 'http://localhost:4000';

// ─── localStorage keys ────────────────────────────────────────────────────────

const ADAPTER_MODE = 'without_library';

const LS = {
  cycleLogs:       'bl_cycleLogs',
  runLogs:         'bl_runLogs',
  consistencyLogs: 'bl_consistencyLogs',
  eventIdCounter:  'bl_eventIdCounter',
  checkIdCounter:  'bl_checkIdCounter',
  repeatCounters:  'bl_repeatCounters',
};

// ─── Internal state ───────────────────────────────────────────────────────────

let _latestRecords   = [];
let _events          = [];                               // session-only (not persisted)
let _cycleLogs       = loadLogs(LS.cycleLogs,       []);
let _runLogs         = loadLogs(LS.runLogs,         []);
let _consistencyLogs = loadLogs(LS.consistencyLogs, []);
let _subscribers     = [];

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
let _runActive         = false;
let _currentRunId      = null;
let _runStartTs        = null;
let _runOnlineStart    = true;
let _currentCycleSeq   = 0;    // per-run sequential counter, resets on startRun
let _runRepeatCounters = loadLogs(LS.repeatCounters, {});
let _runSyncSuccessCount = 0;
let _runSyncFailCount    = 0;
let _runTotalHttpReqs    = 0;
let _runTotalPayloadKB   = 0;
let _runLatencies        = [];
let _runConflicts        = 0;
let _runRetries          = 0;
let _runLostOps          = 0;

// Auto-sync
let _autoSyncHandle = null;
let _paused         = false;

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

// ─── Cycle log helpers ────────────────────────────────────────────────────────

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

// ─── Direct API helper ────────────────────────────────────────────────────────

async function _api(path, options = {}) {
  _cycleHttpReqCount++;
  if (options.body) _cyclePayloadSentBytes += options.body.length;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

async function create(task) {
  const { id, ...fields } = task;
  const record = await _api('/api/tasks', {
    method: 'POST',
    body: JSON.stringify({ id, ...fields }),
  });
  _latestRecords = [..._latestRecords, record];
  _userOpsInScenario++;
  _addEvent({ type: 'op_success', detail: `Created task ${record.id}`, task_id: record.id });
  return record;
}

async function update(id, patch) {
  const existing = _latestRecords.find(t => t.id === id);
  try {
    const record = await _api(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ patch, updatedAt: existing?.updatedAt }),
    });
    _latestRecords = _latestRecords.map(t => t.id === id ? record : t);
    _userOpsInScenario++;
    _addEvent({ type: 'op_success', detail: `Updated task ${id}`, task_id: id });
    _notifyAll();
    return record;
  } catch (err) {
    if (err.status === 409) {
      _conflictsDetected++;
      _runConflicts++;
      _addEvent({ type: 'conflict', detail: `Conflict on task ${id}`, task_id: id, severity: 'warn' });
    }
    throw err;
  }
}

async function remove(id) {
  await _api(`/api/tasks/${id}`, { method: 'DELETE' });
  _latestRecords = _latestRecords.filter(t => t.id !== id);
  _userOpsInScenario++;
  _addEvent({ type: 'op_success', detail: `Deleted task ${id}`, task_id: id });
  _notifyAll();
  return { ok: true };
}

async function get(id) {
  const cached = _latestRecords.find(t => t.id === id);
  if (cached) return cached;
  return _api(`/api/tasks/${id}`);
}

async function list() {
  const start = Date.now();
  try {
    const { records } = await _api('/api/tasks');
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
  const retryCountBefore = _retryCount;
  const conflictCountBefore = _conflictsDetected;
  const beforeRecords    = [..._latestRecords];

  _addEvent({ type: 'sync_start', detail: `Sync triggered (${trigger})` });

  try {
    const { records }    = await _api('/api/tasks');
    const cycleEndTs     = new Date().toISOString();
    const durationMs     = Date.now() - start;
    const onlineAfter    = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const nextRecords    = records || [];
    const appliedUpdates = _countAppliedUpdates(beforeRecords, nextRecords);
    _latestRecords = nextRecords;
    _syncSuccessCount++;
    _runSyncSuccessCount++;
    _latencySamples = [..._latencySamples, durationMs].slice(-20);
    _runLatencies.push(durationMs);
    const cyclePayloadKB = Math.round((_cyclePayloadSentBytes / 1024) * 100) / 100;
    _runTotalHttpReqs  += _cycleHttpReqCount;
    _runTotalPayloadKB += cyclePayloadKB;
    const retriesInCycle   = _retryCount - retryCountBefore;
    const conflictsInCycle = _conflictsDetected - conflictCountBefore;
    _runRetries += retriesInCycle;

    _addEvent({ type: 'sync_done', detail: `Synced ${_latestRecords.length} records · ${durationMs}ms` });

    _addCycleLog({
      cycle_id:         _currentCycleSeq,
      run_id:           _currentRunId,
      scenario_id:      _scenarioId,
      mode:             ADAPTER_MODE,
      trigger,
      success:          'yes',
      cycle_start_ts:   cycleStartTs,
      cycle_end_ts:     cycleEndTs,
      duration_ms:      durationMs,
      online_before:    onlineBefore ? 'yes' : 'no',
      online_after:     onlineAfter  ? 'yes' : 'no',
      queue_before:     0,
      queue_after:      0,
      pushed_ops:       0,
      failed_ops:       0,
      applied_updates:  appliedUpdates,
      retries_cycle:    retriesInCycle,
      conflicts_cycle:  conflictsInCycle,
      http_req_cycle:   _cycleHttpReqCount,
      payload_kb_cycle: cyclePayloadKB,
      error_code:       '',
      error_summary:    '',
    });

    return { ok: true, pushedOps: 0, failedOps: 0, appliedUpdates, durationMs };
  } catch (err) {
    const cycleEndTs     = new Date().toISOString();
    const durationMs     = Date.now() - start;
    const onlineAfter    = typeof navigator !== 'undefined' ? navigator.onLine : true;
    _syncFailCount++;
    _runSyncFailCount++;
    _retryCount++;
    _runRetries++;
    const cyclePayloadKB   = Math.round((_cyclePayloadSentBytes / 1024) * 100) / 100;
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
      queue_before:     0,
      queue_after:      0,
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
    max_queue_depth:      0,
    queue_drain_time_s:   null,
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

  // Auto-run consistency check then patch final_consistency
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
    const { records } = await _api('/api/tasks');
    serverTasks = records || [];
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

// ─── Metrics ──────────────────────────────────────────────────────────────────

async function getMetrics() {
  const total = _syncSuccessCount + _syncFailCount;
  return {
    syncSuccessRate: total === 0 ? 0 : Math.round((_syncSuccessCount / total) * 100),
    avgSyncLatencyMs:
      _latencySamples.length === 0
        ? 0
        : Math.round(_latencySamples.reduce((a, b) => a + b, 0) / _latencySamples.length),
    retryCount: _retryCount,
    queuedOpsCount: 0,    // no offline queue in baseline mode
    conflictsDetected: _conflictsDetected,
  };
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
  return { pruned: 0, kept: _latestRecords.length };
}

async function clearCache() {
  return { ok: true };
}

// ─── Export ───────────────────────────────────────────────────────────────────

const baselineAdapter = {
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
};

export default baselineAdapter;
