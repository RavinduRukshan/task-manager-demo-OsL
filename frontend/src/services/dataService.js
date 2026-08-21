'use client';

// ─── Dispatcher ───────────────────────────────────────────────────────────────
// Thin facade that forwards all calls to whichever adapter is active.
// Switch adapters at runtime by calling setMode() — the toggle in TopBar does this.
// Mode is persisted in localStorage so it survives navigation and hard refresh.

import baselineAdapter from './adapters/baselineAdapter';
import libraryAdapter  from './adapters/libraryAdapter';

// ─── Mode management ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'syncMode';

function _readMode() {
  if (typeof window === 'undefined') return 'with-library';
  return localStorage.getItem(STORAGE_KEY) || 'with-library';
}

let _active = _readMode() === 'with-library' ? libraryAdapter : baselineAdapter;

export function getMode() {
  return _readMode();
}

export function setMode(mode) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, mode);
  }
  _active = mode === 'with-library' ? libraryAdapter : baselineAdapter;
}

// ─── Delegated exports ────────────────────────────────────────────────────────

export const create                 = (...args) => _active.create(...args);
export const update                 = (...args) => _active.update(...args);
export const remove                 = (...args) => _active.remove(...args);
export const get                    = (...args) => _active.get(...args);
export const list                   = (...args) => _active.list(...args);
export const syncNow                = (...args) => _active.syncNow(...args);
export const getMetrics             = (...args) => _active.getMetrics(...args);
export const subscribe              = (...args) => _active.subscribe(...args);
export const startAutoSync          = (...args) => _active.startAutoSync(...args);
export const stopAutoSync           = (...args) => _active.stopAutoSync(...args);
export const pauseSync              = (...args) => _active.pauseSync(...args);
export const resumeSync             = (...args) => _active.resumeSync(...args);
export const setScenarioId          = (...args) => _active.setScenarioId(...args);
export const startRun               = (...args) => _active.startRun(...args);
export const endRun                 = (...args) => _active.endRun(...args);
export const checkConsistency       = (...args) => _active.checkConsistency(...args);
export const clearLogs              = (...args) => _active.clearLogs(...args);
export const pruneCache             = (...args) => _active.pruneCache?.(...args);
export const clearCache             = (...args) => _active.clearCache?.(...args);
export const getDeadLetterOps       = (...args) => _active.getDeadLetterOps?.(...args);
export const retryDeadLetterOp      = (...args) => _active.retryDeadLetterOp?.(...args);
export const discardDeadLetterOps   = (...args) => _active.discardDeadLetterOps?.(...args);
export const switchUser             = (...args) => _active.switchUser?.(...args);
export const logout                 = (...args) => _active.logout?.(...args);
export const purge                  = (...args) => _active.purge?.(...args);
export const setEncryptionPassphrase = (...args) => _active.setEncryptionPassphrase?.(...args);
export const getEncryptionStatus    = (...args) => _active.getEncryptionStatus?.(...args);
export const getClockOffset         = (...args) => _active.getClockOffset?.(...args);
export const setClockOffset         = (...args) => _active.setClockOffset?.(...args);
export const getSchemaVersion       = (...args) => _active.getSchemaVersion?.(...args);
export const migrate                = (...args) => _active.migrate?.(...args);
export const getActiveUserId        = (...args) => _active.getActiveUserId?.(...args);
export const getDbName              = (...args) => _active.getDbName?.(...args);
export const seedDemoData           = (...args) => _active.seedDemoData?.(...args);
export const triggerPoisonPill      = (...args) => _active.triggerPoisonPill?.(...args);
export const simulateSchemaDrift    = (...args) => _active.simulateSchemaDrift?.(...args);
