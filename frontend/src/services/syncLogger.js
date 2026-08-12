'use client';

// ─── Sync Logger Utilities ────────────────────────────────────────────────────
// Shared helpers for run ID generation, localStorage persistence, and
// auto-increment counters used by both adapters.

export function generateRunId(scenarioId, mode) {
  const modeSlug = mode === 'with_library' ? 'with_library' : 'without_library';
  return `${scenarioId}_${modeSlug}_${Date.now()}`;
}

export function loadLogs(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

export function saveLogs(key, data) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (_) {}
}

export function nextId(key) {
  const cur = loadLogs(key, 0);
  const next = cur + 1;
  saveLogs(key, next);
  return next;
}
