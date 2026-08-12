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
  if (typeof window === 'undefined') return 'without-library';
  return localStorage.getItem(STORAGE_KEY) || 'without-library';
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

export const create           = (...args) => _active.create(...args);
export const update           = (...args) => _active.update(...args);
export const remove           = (...args) => _active.remove(...args);
export const get              = (...args) => _active.get(...args);
export const list             = (...args) => _active.list(...args);
export const syncNow          = (...args) => _active.syncNow(...args);
export const getMetrics       = (...args) => _active.getMetrics(...args);
export const subscribe        = (...args) => _active.subscribe(...args);
export const startAutoSync    = (...args) => _active.startAutoSync(...args);
export const stopAutoSync     = (...args) => _active.stopAutoSync(...args);
export const pauseSync        = (...args) => _active.pauseSync(...args);
export const resumeSync       = (...args) => _active.resumeSync(...args);
export const setScenarioId    = (...args) => _active.setScenarioId(...args);
export const startRun         = (...args) => _active.startRun(...args);
export const endRun           = (...args) => _active.endRun(...args);
export const checkConsistency = (...args) => _active.checkConsistency(...args);
export const clearLogs        = (...args) => _active.clearLogs(...args);

