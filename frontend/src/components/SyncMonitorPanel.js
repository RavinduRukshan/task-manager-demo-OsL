'use client';
import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import TableChartIcon from '@mui/icons-material/TableChart';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import AutoDeleteIcon from '@mui/icons-material/AutoDelete';
import LayersClearIcon from '@mui/icons-material/LayersClear';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ReplayIcon from '@mui/icons-material/Replay';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import BugReportIcon from '@mui/icons-material/BugReport';
import StorageIcon from '@mui/icons-material/Storage';
import * as XLSX from 'xlsx';

const SCENARIO_LABELS = {
  S1: 'S1 — Offline Create & Reconnect',
  S2: 'S2 — Rapid Repeated Update & Coalescing',
  S3: 'S3 — Temporary Server Failure & Backoff',
  S4: 'S4 — Concurrent Edit Conflict & Field Merge',
  S5: 'S5 — Poison Pill 4xx & Dead-Letter Queue (DLQ)',
  S6: 'S6 — Multi-Tab Concurrency & Web Locks',
  S7: 'S7 — Multi-User Tenant Isolation & Account Switching',
  S8: 'S8 — At-Rest Vault Encryption (AES-GCM-256)',
  S9: 'S9 — Domain Schema Versioning & Migration',
  S10: 'S10 — Clock Skew Mitigation & Monotonicity',
};

const SEVERITY_COLORS = { info: 'inherit', warn: 'warning.main', error: 'error.main' };

// ─── Shared thin-cell style ───────────────────────────────────────────────────
const TH = { py: 0.3, px: 0.75, fontWeight: 700, fontSize: '0.7rem', whiteSpace: 'nowrap' };
const TD = { py: 0.25, px: 0.75, fontSize: '0.7rem', whiteSpace: 'nowrap' };

const TAB_CONFIG = [
  {
    label: 'Sync Cycle Log',
    target: 'cycleLogs',
    filename: 'sync_cycle_log.csv',
    cols: ['cycle_id','run_id','scenario_id','mode','trigger','success','cycle_start_ts','cycle_end_ts','duration_ms','online_before','online_after','queue_before','queue_after','pushed_ops','failed_ops','applied_updates','retries_cycle','conflicts_cycle','http_req_cycle','payload_kb_cycle','error_code','error_summary'],
  },
  {
    label: 'Run Summary',
    target: 'runLogs',
    filename: 'run_summary.csv',
    cols: ['run_id','scenario_id','mode','repeat_no','run_start_ts','run_end_ts','online_start','online_end','total_user_ops','total_cycles','http_requests_total','payload_kb_total','avg_response_ms','sync_success_rate','avg_sync_latency_ms','retry_count_total','max_queue_depth','queue_drain_time_s','conflict_count_total','lost_ops_count','final_consistency','notes'],
  },
  {
    label: 'Event Log',
    target: 'events',
    filename: 'event_log.csv',
    cols: ['event_id','run_id','cycle_id','event_ts','event_type','task_id','severity','detail'],
  },
  {
    label: 'Consistency Check',
    target: 'consistencyLogs',
    filename: 'consistency_check_log.csv',
    cols: ['check_id','run_id','checked_ts','task_id','expected_state','local_state','server_state','is_consistent','mismatch_type','mismatch_detail'],
  },
];

function exportExcel(allData, filename) {
  const wb = XLSX.utils.book_new();
  allData.forEach(({ label, rows, cols }) => {
    const ws = XLSX.utils.json_to_sheet(rows.map(row => {
      const out = {};
      cols.forEach(c => { out[c] = row[c] ?? ''; });
      return out;
    }), { header: cols });
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, label.substring(0, 31));
  });
  XLSX.writeFile(wb, filename);
}

function exportCsv(rows, cols, filename) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.join(','), ...rows.map(row => cols.map(c => escape(row[c])).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SyncMonitorPanel({
  mode = 'with-library',
  onSyncNow,
  onStartAutoSync,
  onStopAutoSync,
  onPauseSync,
  onResumeSync,
  onPruneCache,
  onClearCache,
  onGetDeadLetterOps,
  onRetryDeadLetterOp,
  onDiscardDeadLetterOps,
  getClockOffset,
  setClockOffset,
  getSchemaVersion,
  onMigrate,
  onTriggerPoisonPill,
  onSimulateSchemaDrift,
  userId = 'alice',
  dbName = '',
  schemaVersion = 1,
  encrypted = false,
  getMetrics,
  syncEvents = [],
  cycleLogs = [],
  runLogs = [],
  consistencyLogs = [],
  runActive = false,
  currentRunId = null,
  scenarioId = 'N/A',
  onScenarioChange,
  onStartRun,
  onEndRun,
  onCheckConsistency,
  onClearLogs,
  rightDock = false,
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState(0);
  const [metrics, setMetrics] = useState({
    syncSuccessRate: 0,
    avgSyncLatencyMs: 0,
    retryCount: 0,
    queuedOpsCount: 0,
    deadLetteredOpsCount: 0,
    conflictsDetected: 0,
  });

  const [confirmClear, setConfirmClear] = useState(false);
  const [pruneDialogOpen, setPruneDialogOpen] = useState(false);
  const [pruneMax, setPruneMax] = useState(5);
  const [clearCacheDialogOpen, setClearCacheDialogOpen] = useState(false);
  const [dlqDialogOpen, setDlqDialogOpen] = useState(false);
  const [dlqOps, setDlqOps] = useState([]);
  const [dlqLoading, setDlqLoading] = useState(false);

  // Clock skew dialog
  const [clockDialogOpen, setClockDialogOpen] = useState(false);
  const [clockSkewInput, setClockSkewInput] = useState(0);
  const [currentClockSkew, setCurrentClockSkew] = useState(0);

  // Schema migration dialog
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false);
  const [activeSchemaVer, setActiveSchemaVer] = useState(schemaVersion || 1);

  const TAB_DATA = [cycleLogs, runLogs, syncEvents, consistencyLogs];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsOnline(navigator.onLine);
    const onOnline  = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (getMetrics) {
      getMetrics().then(setMetrics).catch(() => {});
    }
    if (getClockOffset) {
      setCurrentClockSkew(getClockOffset());
    }
    if (getSchemaVersion) {
      getSchemaVersion().then(setActiveSchemaVer).catch(() => {});
    }
  }, [syncEvents, getMetrics, getClockOffset, getSchemaVersion]);

  const wrapperSx = rightDock
    ? {
        width: collapsed ? 56 : 640,
        minWidth: collapsed ? 56 : 320,
        maxWidth: collapsed ? 56 : 960,
        resize: collapsed ? 'none' : 'horizontal',
        overflow: 'auto',
        borderLeft: '2px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }
    : { width: '100%' };

  return (
    <Box sx={wrapperSx}>
      <Paper
        elevation={4}
        square
        sx={{
          p: 1.5,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderTop: rightDock ? 'none' : '2px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {/* ── Header row ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight="bold" sx={{ mr: 0.5 }}>
            {collapsed ? 'Sync' : 'Sync Monitor'}
          </Typography>

          {rightDock && (
            <Tooltip title={collapsed ? 'Expand monitor' : 'Collapse monitor'}>
              <IconButton size="small" onClick={() => setCollapsed(p => !p)}>
                {collapsed
                  ? <KeyboardDoubleArrowLeftIcon fontSize="small" />
                  : <KeyboardDoubleArrowRightIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}

          {!collapsed && (
            <>
              <Chip
                icon={isOnline ? <WifiIcon fontSize="small" /> : <WifiOffIcon fontSize="small" />}
                label={isOnline ? 'Online' : 'Offline'}
                color={isOnline ? 'success' : 'error'}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              <Chip
                label={mode === 'with-library' ? 'SDK v0.4.0' : 'Direct Fetch'}
                color={mode === 'with-library' ? 'primary' : 'default'}
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              <Chip
                label={`User: ${userId}`}
                color="secondary"
                size="small"
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />

              {/* Scenario selector */}
              <FormControl size="small" sx={{ minWidth: 100 }} disabled={runActive}>
                <InputLabel id="scenario-select-label" sx={{ fontSize: '0.7rem' }}>Scenario</InputLabel>
                <Select
                  labelId="scenario-select-label"
                  value={scenarioId}
                  label="Scenario"
                  onChange={e => onScenarioChange && onScenarioChange(e.target.value)}
                  sx={{ fontSize: '0.75rem', height: 28 }}
                >
                  {['N/A', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontSize: '0.75rem' }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

              {/* Run lifecycle buttons */}
              <Tooltip title={runActive ? '' : (scenarioId === 'N/A' ? 'Select a scenario first' : 'Start a new run')}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrowIcon sx={{ fontSize: '0.85rem !important' }} />}
                    disabled={runActive || scenarioId === 'N/A'}
                    onClick={() => onStartRun && onStartRun(scenarioId)}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2 }}
                  >
                    Start Run
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title={!runActive ? 'No active run' : 'End the current run'}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="error"
                    startIcon={<StopIcon sx={{ fontSize: '0.85rem !important' }} />}
                    disabled={!runActive}
                    onClick={() => onEndRun && onEndRun()}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2 }}
                  >
                    End Run
                  </Button>
                </span>
              </Tooltip>

              <Tooltip title="Check consistency against server (targets most recent run)">
                <span>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FactCheckIcon sx={{ fontSize: '0.85rem !important' }} />}
                    disabled={!currentRunId && runLogs.length === 0}
                    onClick={() => onCheckConsistency && onCheckConsistency()}
                    sx={{ textTransform: 'none', fontSize: '0.7rem', py: 0.2 }}
                  >
                    Check
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
        </Box>

        {!collapsed && (
          <>
            {/* ── Secondary Controls & Feature Action Bar ── */}
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
              <Button size="small" variant="contained" onClick={onSyncNow} sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}>
                Sync Now
              </Button>
              <Button size="small" variant="outlined" onClick={onStartAutoSync} sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}>
                Auto ▶
              </Button>
              <Button size="small" variant="outlined" onClick={onStopAutoSync} sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}>
                Auto ■
              </Button>
              <Button size="small" variant="outlined" onClick={onPauseSync} sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}>
                Pause
              </Button>
              <Button size="small" variant="outlined" onClick={onResumeSync} sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}>
                Resume
              </Button>

              {mode === 'with-library' && (
                <>
                  <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />

                  {/* Clock Skew Simulator */}
                  <Tooltip title="View NTP clock offset & calibrate / simulate device clock skew">
                    <Button
                      size="small"
                      variant="outlined"
                      color={currentClockSkew !== 0 ? 'warning' : 'inherit'}
                      startIcon={<AccessTimeIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={() => setClockDialogOpen(true)}
                      sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                    >
                      Clock ({currentClockSkew}ms)
                    </Button>
                  </Tooltip>

                  {/* Schema & Migrations */}
                  <Tooltip title="Manage domain schema versions and test stepwise record migrations & drift">
                    <Button
                      size="small"
                      variant="outlined"
                      color="info"
                      startIcon={<DynamicFeedIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={() => setSchemaDialogOpen(true)}
                      sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                    >
                      Schema v{activeSchemaVer}
                    </Button>
                  </Tooltip>

                  {/* Poison Pill Trigger for DLQ Testing */}
                  {onTriggerPoisonPill && (
                    <Tooltip title="Inject a poison pill operation to test 422 error & Dead-Letter Queue quarantine">
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<BugReportIcon sx={{ fontSize: '0.8rem !important' }} />}
                        onClick={async () => {
                          await onTriggerPoisonPill('__POISON_PILL__');
                        }}
                        sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                      >
                        Poison Pill
                      </Button>
                    </Tooltip>
                  )}

                  {/* Prune Cache */}
                  <Tooltip title="Prune oldest cached records from IndexedDB">
                    <Button
                      size="small"
                      variant="outlined"
                      color="secondary"
                      startIcon={<AutoDeleteIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={() => setPruneDialogOpen(true)}
                      sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                    >
                      Prune Cache
                    </Button>
                  </Tooltip>

                  {/* Clear Cache */}
                  <Tooltip title="Clear cached records while preserving unsynced ops">
                    <Button
                      size="small"
                      variant="outlined"
                      color="warning"
                      startIcon={<LayersClearIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={() => setClearCacheDialogOpen(true)}
                      sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                    >
                      Clear Cache
                    </Button>
                  </Tooltip>

                  {/* DLQ */}
                  <Tooltip title="View & manage quarantined operations in Dead-Letter Queue">
                    <Button
                      size="small"
                      variant="outlined"
                      color={metrics.deadLetteredOpsCount > 0 ? 'error' : 'inherit'}
                      startIcon={<WarningAmberIcon sx={{ fontSize: '0.8rem !important' }} />}
                      onClick={async () => {
                        setDlqDialogOpen(true);
                        setDlqLoading(true);
                        if (onGetDeadLetterOps) {
                          try {
                            const ops = await onGetDeadLetterOps();
                            setDlqOps(ops || []);
                          } catch (_) {}
                        }
                        setDlqLoading(false);
                      }}
                      sx={{ fontSize: '0.68rem', textTransform: 'none', py: 0.2 }}
                    >
                      DLQ {metrics.deadLetteredOpsCount > 0 ? `(${metrics.deadLetteredOpsCount})` : ''}
                    </Button>
                  </Tooltip>
                </>
              )}
            </Box>

            {/* ── Active run info bar & Tenant metadata ── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
              {runActive && currentRunId && (
                <Chip
                  label={`Run active: ${currentRunId}`}
                  color="warning"
                  size="small"
                  sx={{ fontSize: '0.65rem', height: 20 }}
                />
              )}
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                {SCENARIO_LABELS[scenarioId] || scenarioId}
              </Typography>
              {dbName && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', ml: 'auto' }}>
                  IDB: {dbName} {encrypted ? '🔒' : ''}
                </Typography>
              )}
            </Box>

            <Divider sx={{ mb: 0.5 }} />

            {/* ── Quick metrics row ── */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 0.5, justifyContent: 'space-between' }}>
              <MetricBadge label="Success Rate" value={`${metrics.syncSuccessRate}%`} />
              <MetricBadge label="Avg Latency"  value={`${metrics.avgSyncLatencyMs} ms`} />
              <MetricBadge label="Queued"        value={metrics.queuedOpsCount} />
              <MetricBadge label="DLQ"           value={metrics.deadLetteredOpsCount || 0} color={metrics.deadLetteredOpsCount > 0 ? 'error.main' : 'inherit'} />
              <MetricBadge label="Retries"       value={metrics.retryCount} />
              <MetricBadge label="Conflicts"     value={metrics.conflictsDetected} />
              <MetricBadge label="Clock Skew"    value={`${currentClockSkew} ms`} color={currentClockSkew !== 0 ? 'warning.main' : 'inherit'} />
            </Box>

            <Divider sx={{ mb: 0.5 }} />

            {/* ── Tab bar ── */}
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 30, mb: 0.5 }}
              TabIndicatorProps={{ style: { height: 2 } }}
            >
              <Tab label="Sync Cycle Log"     sx={{ fontSize: '0.72rem', minHeight: 30, py: 0 }} />
              <Tab label="Run Summary"        sx={{ fontSize: '0.72rem', minHeight: 30, py: 0 }} />
              <Tab label="Event Log"          sx={{ fontSize: '0.72rem', minHeight: 30, py: 0 }} />
              <Tab label="Consistency Check"  sx={{ fontSize: '0.72rem', minHeight: 30, py: 0 }} />
            </Tabs>

            {/* ── Tab 0: Sync Cycle Log ── */}
            {tab === 0 && (
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                {cycleLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                    No cycles recorded yet. Click &quot;Sync Now&quot; to run a cycle.
                  </Typography>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['cycle_id','run_id','scenario_id','mode','trigger','success',
                          'cycle_start_ts','cycle_end_ts','duration_ms','online_before',
                          'online_after','queue_before','queue_after','pushed_ops','failed_ops',
                          'applied_updates','retries_cycle','conflicts_cycle',
                          'http_req_cycle','payload_kb_cycle','error_code','error_summary',
                        ].map(col => (
                          <TableCell key={col} sx={TH}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {cycleLogs.slice(0, 50).map((c, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={TD}>{c.cycle_id}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.run_id}>{c.run_id ?? '—'}</TableCell>
                          <TableCell sx={TD}>{c.scenario_id}</TableCell>
                          <TableCell sx={TD}>{c.mode}</TableCell>
                          <TableCell sx={TD}>{c.trigger}</TableCell>
                          <TableCell sx={{ ...TD, color: c.success === 'yes' ? 'success.main' : 'error.main', fontWeight: 600 }}>{c.success}</TableCell>
                          <TableCell sx={TD}>{c.cycle_start_ts ? new Date(c.cycle_start_ts).toLocaleTimeString() : '—'}</TableCell>
                          <TableCell sx={TD}>{c.cycle_end_ts   ? new Date(c.cycle_end_ts).toLocaleTimeString()   : '—'}</TableCell>
                          <TableCell sx={TD}>{c.duration_ms}</TableCell>
                          <TableCell sx={TD}>{c.online_before}</TableCell>
                          <TableCell sx={TD}>{c.online_after}</TableCell>
                          <TableCell sx={TD}>{c.queue_before}</TableCell>
                          <TableCell sx={TD}>{c.queue_after}</TableCell>
                          <TableCell sx={TD}>{c.pushed_ops}</TableCell>
                          <TableCell sx={TD}>{c.failed_ops}</TableCell>
                          <TableCell sx={TD}>{c.applied_updates}</TableCell>
                          <TableCell sx={TD}>{c.retries_cycle}</TableCell>
                          <TableCell sx={TD}>{c.conflicts_cycle}</TableCell>
                          <TableCell sx={TD}>{c.http_req_cycle}</TableCell>
                          <TableCell sx={TD}>{c.payload_kb_cycle}</TableCell>
                          <TableCell sx={TD}>{c.error_code || '—'}</TableCell>
                          <TableCell sx={{ ...TD, color: c.error_summary ? 'error.main' : 'text.secondary', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.error_summary}>{c.error_summary || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            )}

            {/* ── Tab 1: Run Summary ── */}
            {tab === 1 && (
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                {runLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                    No completed runs yet. Start a run, perform syncs, then click &quot;End Run&quot;.
                  </Typography>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['run_id','scenario_id','mode','repeat_no','run_start_ts','run_end_ts',
                          'online_start','online_end','total_user_ops','total_cycles',
                          'http_requests_total','payload_kb_total','avg_response_ms',
                          'sync_success_rate','avg_sync_latency_ms','retry_count_total',
                          'max_queue_depth','queue_drain_time_s','conflict_count_total',
                          'lost_ops_count','final_consistency','notes',
                        ].map(col => (
                          <TableCell key={col} sx={TH}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {runLogs.map((r, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.run_id}>{r.run_id}</TableCell>
                          <TableCell sx={TD}>{r.scenario_id}</TableCell>
                          <TableCell sx={TD}>{r.mode}</TableCell>
                          <TableCell sx={TD}>{r.repeat_no}</TableCell>
                          <TableCell sx={TD}>{r.run_start_ts ? new Date(r.run_start_ts).toLocaleTimeString() : '—'}</TableCell>
                          <TableCell sx={TD}>{r.run_end_ts   ? new Date(r.run_end_ts).toLocaleTimeString()   : '—'}</TableCell>
                          <TableCell sx={TD}>{r.online_start}</TableCell>
                          <TableCell sx={TD}>{r.online_end}</TableCell>
                          <TableCell sx={TD}>{r.total_user_ops}</TableCell>
                          <TableCell sx={TD}>{r.total_cycles}</TableCell>
                          <TableCell sx={TD}>{r.http_requests_total}</TableCell>
                          <TableCell sx={TD}>{r.payload_kb_total}</TableCell>
                          <TableCell sx={TD}>{r.avg_response_ms}</TableCell>
                          <TableCell sx={TD}>{r.sync_success_rate}</TableCell>
                          <TableCell sx={TD}>{r.avg_sync_latency_ms}</TableCell>
                          <TableCell sx={TD}>{r.retry_count_total}</TableCell>
                          <TableCell sx={TD}>{r.max_queue_depth}</TableCell>
                          <TableCell sx={TD}>{r.queue_drain_time_s ?? '—'}</TableCell>
                          <TableCell sx={TD}>{r.conflict_count_total}</TableCell>
                          <TableCell sx={TD}>{r.lost_ops_count}</TableCell>
                          <TableCell sx={{ ...TD, color: r.final_consistency === 'yes' ? 'success.main' : r.final_consistency === 'no' ? 'error.main' : 'text.secondary', fontWeight: 600 }}>{r.final_consistency}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.notes}>{r.notes || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            )}

            {/* ── Tab 2: Event Log ── */}
            {tab === 2 && (
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                {syncEvents.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                    No events recorded yet.
                  </Typography>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['event_id','run_id','cycle_id','event_ts','event_type','task_id','severity','detail'].map(col => (
                          <TableCell key={col} sx={TH}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {syncEvents.slice(0, 200).map((e, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={TD}>{e.event_id}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.run_id}>{e.run_id ?? '—'}</TableCell>
                          <TableCell sx={TD}>{e.cycle_id ?? '—'}</TableCell>
                          <TableCell sx={TD}>{e.event_ts ? new Date(e.event_ts).toLocaleTimeString() : '—'}</TableCell>
                          <TableCell sx={TD}>
                            {e.event_type === 'cache_pruned' ? (
                              <Chip label="cache_pruned" size="small" color="secondary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'cache_cleared' ? (
                              <Chip label="cache_cleared" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'op_dead_letter' ? (
                              <Chip label="op_dead_letter" size="small" color="error" variant="filled" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'sync_skipped' ? (
                              <Chip label="sync_skipped" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'schema_drift' ? (
                              <Chip label="schema_drift" size="small" color="warning" variant="filled" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'schema_migrated' ? (
                              <Chip label="schema_migrated" size="small" color="success" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'user_switched' ? (
                              <Chip label="user_switched" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'clock_calibrated' ? (
                              <Chip label="clock_calibrated" size="small" color="info" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'dlq_retry' ? (
                              <Chip label="dlq_retry" size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : e.event_type === 'dlq_discard' ? (
                              <Chip label="dlq_discard" size="small" color="warning" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ) : (
                              e.event_type
                            )}
                          </TableCell>
                          <TableCell sx={TD}>{e.task_id ?? '—'}</TableCell>
                          <TableCell sx={{ ...TD, color: SEVERITY_COLORS[e.severity] || 'inherit', fontWeight: e.severity !== 'info' ? 600 : 400 }}>{e.severity}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.detail}>{e.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            )}

            {/* ── Tab 3: Consistency Check Log ── */}
            {tab === 3 && (
              <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                {consistencyLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ p: 1, display: 'block' }}>
                    No consistency checks yet. End a run or click &quot;Check&quot; to run a check.
                  </Typography>
                ) : (
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        {['check_id','run_id','checked_ts','task_id','expected_state','local_state','server_state','is_consistent','mismatch_type','mismatch_detail'].map(col => (
                          <TableCell key={col} sx={TH}>{col}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {consistencyLogs.map((c, i) => (
                        <TableRow key={i} hover>
                          <TableCell sx={TD}>{c.check_id}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.run_id}>{c.run_id}</TableCell>
                          <TableCell sx={TD}>{c.checked_ts ? new Date(c.checked_ts).toLocaleTimeString() : '—'}</TableCell>
                          <TableCell sx={TD}>{c.task_id}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.expected_state}>{c.expected_state}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.local_state}>{c.local_state}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.server_state}>{c.server_state}</TableCell>
                          <TableCell sx={{ ...TD, color: c.is_consistent === 'yes' ? 'success.main' : 'error.main', fontWeight: 600 }}>{c.is_consistent}</TableCell>
                          <TableCell sx={TD}>{c.mismatch_type || '—'}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.mismatch_detail}>{c.mismatch_detail || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            )}

            {/* ── Clear / Export bar ── */}
            <Divider sx={{ mt: 0.5 }} />
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', py: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon fontSize="small" />}
                disabled={TAB_DATA[tab].length === 0}
                onClick={() => setConfirmClear(true)}
                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
              >
                Clear
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon fontSize="small" />}
                disabled={TAB_DATA[tab].length === 0}
                onClick={() => exportCsv(TAB_DATA[tab], TAB_CONFIG[tab].cols, TAB_CONFIG[tab].filename)}
                sx={{ fontSize: '0.7rem', textTransform: 'none' }}
              >
                Export CSV
              </Button>
              <Tooltip title="Export all tables as one Excel workbook (4 sheets)">
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<TableChartIcon fontSize="small" />}
                    disabled={TAB_DATA.every(d => d.length === 0)}
                    onClick={() => exportExcel(
                      TAB_CONFIG.map((cfg, i) => ({ label: cfg.label, rows: TAB_DATA[i], cols: cfg.cols })),
                      'sync_monitor_export.xlsx'
                    )}
                    sx={{ fontSize: '0.7rem', textTransform: 'none' }}
                  >
                    Export Excel
                  </Button>
                </span>
              </Tooltip>
            </Box>

            {/* ── Clear Confirmation Dialog ── */}
            <Dialog open={confirmClear} onClose={() => setConfirmClear(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: '0.9rem', pb: 1 }}>
                Clear &quot;{TAB_CONFIG[tab].label}&quot;?
              </DialogTitle>
              <DialogActions>
                <Button size="small" onClick={() => setConfirmClear(false)}>Cancel</Button>
                <Button size="small" color="error" variant="contained" onClick={() => {
                  onClearLogs && onClearLogs(TAB_CONFIG[tab].target);
                  setConfirmClear(false);
                }}>Clear</Button>
              </DialogActions>
            </Dialog>

            {/* ── Prune Cache Dialog ── */}
            <Dialog open={pruneDialogOpen} onClose={() => setPruneDialogOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: '0.9rem', pb: 1 }}>
                Prune Local Cache
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <DialogContentText sx={{ fontSize: '0.8rem', mb: 2 }}>
                  Keep only the newest records in local IndexedDB. Oldest records will be evicted. Records with pending unsynced operations will be safely preserved.
                </DialogContentText>
                <TextField
                  type="number"
                  size="small"
                  label="Max Records to Keep"
                  value={pruneMax}
                  onChange={(e) => setPruneMax(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  fullWidth
                  inputProps={{ min: 0 }}
                  sx={{ '& input': { fontSize: '0.85rem' } }}
                />
              </DialogContent>
              <DialogActions>
                <Button size="small" onClick={() => setPruneDialogOpen(false)}>Cancel</Button>
                <Button
                  size="small"
                  color="secondary"
                  variant="contained"
                  onClick={async () => {
                    setPruneDialogOpen(false);
                    if (onPruneCache) await onPruneCache(pruneMax);
                  }}
                >
                  Prune to {pruneMax}
                </Button>
              </DialogActions>
            </Dialog>

            {/* ── Clear Cache Dialog ── */}
            <Dialog open={clearCacheDialogOpen} onClose={() => setClearCacheDialogOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: '0.9rem', pb: 1 }}>
                Clear Local Cache
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <DialogContentText sx={{ fontSize: '0.8rem' }}>
                  Clear all cached tasks from local IndexedDB? Pending unsynced operations in the ops queue will NOT be deleted.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button size="small" onClick={() => setClearCacheDialogOpen(false)}>Cancel</Button>
                <Button
                  size="small"
                  color="warning"
                  variant="contained"
                  onClick={async () => {
                    setClearCacheDialogOpen(false);
                    if (onClearCache) await onClearCache();
                  }}
                >
                  Clear Cache
                </Button>
              </DialogActions>
            </Dialog>

            {/* ── Dead-Letter Queue (DLQ) Dialog ── */}
            <Dialog open={dlqDialogOpen} onClose={() => setDlqDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle sx={{ fontSize: '0.95rem', pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningAmberIcon color="warning" fontSize="small" />
                Dead-Letter Queue (Quarantined Operations)
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <DialogContentText sx={{ fontSize: '0.8rem', mb: 1.5 }}>
                  Operations that encountered permanent non-retryable client errors (e.g. 400, 422, 403) are quarantined here after exceeding failure thresholds to prevent poison pill loops.
                </DialogContentText>
                {dlqLoading ? (
                  <Typography variant="caption" color="text.secondary">Loading DLQ operations...</Typography>
                ) : dlqOps.length === 0 ? (
                  <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      No quarantined operations in the Dead-Letter Queue.
                    </Typography>
                  </Box>
                ) : (
                  <TableContainer sx={{ maxHeight: 260, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={TH}>Type</TableCell>
                          <TableCell sx={TH}>Task ID</TableCell>
                          <TableCell sx={TH}>Error / Detail</TableCell>
                          <TableCell sx={TH} align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {dlqOps.map((op) => (
                          <TableRow key={op.key || op.id} hover>
                            <TableCell sx={TD}>
                              <Chip label={op.type} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                            </TableCell>
                            <TableCell sx={TD}>{op.id || '—'}</TableCell>
                            <TableCell sx={{ ...TD, color: 'error.main', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={op.lastError || op.error}>
                              {op.lastError || op.error || 'Permanent failure'}
                            </TableCell>
                            <TableCell sx={TD} align="right">
                              <Button
                                size="small"
                                variant="outlined"
                                color="primary"
                                startIcon={<ReplayIcon sx={{ fontSize: '0.75rem !important' }} />}
                                onClick={async () => {
                                  if (onRetryDeadLetterOp) {
                                    await onRetryDeadLetterOp(op.key);
                                    if (onGetDeadLetterOps) {
                                      const updated = await onGetDeadLetterOps();
                                      setDlqOps(updated || []);
                                    }
                                  }
                                }}
                                sx={{ fontSize: '0.65rem', py: 0.2, px: 0.6, textTransform: 'none' }}
                              >
                                Retry
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                {dlqOps.length > 0 && (
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={async () => {
                      if (onDiscardDeadLetterOps) {
                        await onDiscardDeadLetterOps();
                        setDlqOps([]);
                      }
                    }}
                    sx={{ mr: 'auto', textTransform: 'none' }}
                  >
                    Discard All ({dlqOps.length})
                  </Button>
                )}
                <Button size="small" onClick={() => setDlqDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>

            {/* ── Clock Skew Simulator Dialog ── */}
            <Dialog open={clockDialogOpen} onClose={() => setClockDialogOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccessTimeIcon color="primary" fontSize="small" />
                Clock Skew Simulator & Calibration
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <DialogContentText sx={{ fontSize: '0.8rem', mb: 2 }}>
                  <code>offline-sync-lite</code> performs passive NTP-lite RTT server time calibration and guarantees monotonic causality even when client physical clocks are skewed into the past or future.
                </DialogContentText>
                <TextField
                  type="number"
                  size="small"
                  label="Simulated Clock Offset (ms)"
                  value={clockSkewInput}
                  onChange={(e) => setClockSkewInput(parseInt(e.target.value, 10) || 0)}
                  fullWidth
                  helperText="Positive = device clock ahead; Negative = device clock behind server"
                />
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap' }}>
                  <Button size="small" variant="outlined" onClick={() => setClockSkewInput(-10000)} sx={{ fontSize: '0.68rem' }}>-10s Past</Button>
                  <Button size="small" variant="outlined" onClick={() => setClockSkewInput(5000)} sx={{ fontSize: '0.68rem' }}>+5s Ahead</Button>
                  <Button size="small" variant="outlined" onClick={() => setClockSkewInput(60000)} sx={{ fontSize: '0.68rem' }}>+60s Future</Button>
                  <Button size="small" variant="outlined" onClick={() => setClockSkewInput(0)} sx={{ fontSize: '0.68rem' }}>0 (Reset)</Button>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button size="small" onClick={() => setClockDialogOpen(false)}>Cancel</Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={async () => {
                    setClockDialogOpen(false);
                    if (setClockOffset) {
                      await setClockOffset(clockSkewInput);
                      setCurrentClockSkew(clockSkewInput);
                    }
                  }}
                >
                  Apply Offset
                </Button>
              </DialogActions>
            </Dialog>

            {/* ── Schema Version & Migration Dialog ── */}
            <Dialog open={schemaDialogOpen} onClose={() => setSchemaDialogOpen(false)} maxWidth="xs" fullWidth>
              <DialogTitle sx={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
                <DynamicFeedIcon color="primary" fontSize="small" />
                Schema Versioning & Migrations
              </DialogTitle>
              <DialogContent sx={{ pt: 1 }}>
                <DialogContentText sx={{ fontSize: '0.8rem', mb: 1.5 }}>
                  Current domain schema: <strong>v{activeSchemaVer}</strong>. Stepwise migrations sequentially transform cached IndexedDB records and queued mutations.
                </DialogContentText>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={async () => {
                      setSchemaDialogOpen(false);
                      if (onMigrate) await onMigrate(2);
                    }}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  >
                    Run Migration to v2 (Ensure tags & points defaults)
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="primary"
                    onClick={async () => {
                      setSchemaDialogOpen(false);
                      if (onMigrate) await onMigrate(3);
                    }}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  >
                    Run Migration to v3 (Normalize status & assignee)
                  </Button>
                  <Divider sx={{ my: 0.5 }} />
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={async () => {
                      setSchemaDialogOpen(false);
                      if (onSimulateSchemaDrift) await onSimulateSchemaDrift(2);
                    }}
                    sx={{ textTransform: 'none', justifyContent: 'flex-start', fontSize: '0.75rem' }}
                  >
                    Simulate Server Drift (Set Server Schema to v2)
                  </Button>
                </Box>
              </DialogContent>
              <DialogActions>
                <Button size="small" onClick={() => setSchemaDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Paper>
    </Box>
  );
}

function MetricBadge({ label, value, color }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 55 }}>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1, fontSize: '0.65rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="bold" sx={{ lineHeight: 1.3, color: color || 'inherit', fontSize: '0.78rem' }}>
        {value}
      </Typography>
    </Box>
  );
}
