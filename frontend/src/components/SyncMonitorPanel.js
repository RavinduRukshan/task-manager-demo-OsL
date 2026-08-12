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
import DialogActions from '@mui/material/DialogActions';
import * as XLSX from 'xlsx';

const SCENARIO_LABELS = {
  S1: 'S1 — Offline Create & Reconnect',
  S2: 'S2 — Rapid Repeated Update',
  S3: 'S3 — Temporary Server Failure',
  S4: 'S4 — Concurrent Edit Conflict',
};

const SEVERITY_COLORS = { info: 'inherit', warn: 'warning.main', error: 'error.main' };

// â”€â”€â”€ Shared thin-cell style â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Set column widths based on header length
    ws['!cols'] = cols.map(c => ({ wch: Math.max(c.length + 2, 12) }));
    XLSX.utils.book_append_sheet(wb, ws, label.substring(0, 31)); // sheet name max 31 chars
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
  mode = 'without-library',
  onSyncNow,
  onStartAutoSync,
  onStopAutoSync,
  onPauseSync,
  onResumeSync,
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
    conflictsDetected: 0,
  });
  const [confirmClear, setConfirmClear] = useState(false);
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
    getMetrics().then(setMetrics);
  }, [syncEvents, getMetrics]);

  const wrapperSx = rightDock
    ? {
        width: collapsed ? 56 : 620,
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
        {/* â”€â”€ Header row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
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
              />
              <Chip
                label={mode === 'with-library' ? 'Library' : 'Direct Fetch'}
                color={mode === 'with-library' ? 'primary' : 'default'}
                size="small"
                variant="outlined"
              />

              {/* Scenario selector — locked while a run is active */}
              <FormControl size="small" sx={{ minWidth: 90 }} disabled={runActive}>
                <InputLabel id="scenario-select-label" sx={{ fontSize: '0.7rem' }}>Scenario</InputLabel>
                <Select
                  labelId="scenario-select-label"
                  value={scenarioId}
                  label="Scenario"
                  onChange={e => onScenarioChange && onScenarioChange(e.target.value)}
                  sx={{ fontSize: '0.75rem' }}
                >
                  {['N/A', 'S1', 'S2', 'S3', 'S4'].map(s => (
                    <MenuItem key={s} value={s} sx={{ fontSize: '0.75rem' }}>{s}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Divider orientation="vertical" flexItem />

              {/* Run lifecycle buttons */}
              <Tooltip title={runActive ? '' : (scenarioId === 'N/A' ? 'Select a scenario first' : 'Start a new run')}>
                <span>
                  <Button
                    size="small"
                    variant="contained"
                    color="success"
                    startIcon={<PlayArrowIcon />}
                    disabled={runActive || scenarioId === 'N/A'}
                    onClick={() => onStartRun && onStartRun(scenarioId)}
                    sx={{ textTransform: 'none', fontSize: '0.72rem' }}
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
                    startIcon={<StopIcon />}
                    disabled={!runActive}
                    onClick={() => onEndRun && onEndRun()}
                    sx={{ textTransform: 'none', fontSize: '0.72rem' }}
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
                    startIcon={<FactCheckIcon />}
                    disabled={!currentRunId && runLogs.length === 0}
                    onClick={() => onCheckConsistency && onCheckConsistency()}
                    sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                  >
                    Check
                  </Button>
                </span>
              </Tooltip>

              <Divider orientation="vertical" flexItem />

              {/* Sync controls */}
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Button size="small" variant="contained"  onClick={onSyncNow}       sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Sync Now</Button>
                <Button size="small" variant="outlined"   onClick={onStartAutoSync} sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Auto ▶</Button>
                <Button size="small" variant="outlined"   onClick={onStopAutoSync}  sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Auto ■</Button>
                <Button size="small" variant="outlined"   onClick={onPauseSync}     sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Pause</Button>
                <Button size="small" variant="outlined"   onClick={onResumeSync}    sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Resume</Button>
              </Box>
            </>
          )}
        </Box>

        {!collapsed && (
          <>
            {/* Active run info bar */}
            {runActive && currentRunId && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip
                  label={`Run active: ${currentRunId}`}
                  color="warning"
                  size="small"
                  sx={{ fontSize: '0.65rem', maxWidth: '100%' }}
                />
                <Typography variant="caption" color="text.secondary">
                  {SCENARIO_LABELS[scenarioId] || scenarioId}
                </Typography>
              </Box>
            )}

            <Divider sx={{ mb: 0.5 }} />

            {/* Quick metrics row */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 0.5 }}>
              <MetricBadge label="Success Rate" value={`${metrics.syncSuccessRate}%`} />
              <MetricBadge label="Avg Latency"  value={`${metrics.avgSyncLatencyMs} ms`} />
              <MetricBadge label="Queued"        value={metrics.queuedOpsCount} />
              <MetricBadge label="Retries"       value={metrics.retryCount} />
              <MetricBadge label="Conflicts"     value={metrics.conflictsDetected} />
            </Box>

            <Divider sx={{ mb: 0.5 }} />

            {/* Tab bar */}
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ minHeight: 32, mb: 0.5 }}
              TabIndicatorProps={{ style: { height: 2 } }}
            >
              <Tab label="Sync Cycle Log"     sx={{ fontSize: '0.72rem', minHeight: 32, py: 0 }} />
              <Tab label="Run Summary"        sx={{ fontSize: '0.72rem', minHeight: 32, py: 0 }} />
              <Tab label="Event Log"          sx={{ fontSize: '0.72rem', minHeight: 32, py: 0 }} />
              <Tab label="Consistency Check"  sx={{ fontSize: '0.72rem', minHeight: 32, py: 0 }} />
            </Tabs>

            {/* â”€â”€ Tab 0: Sync Cycle Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

            {/* â”€â”€ Tab 1: Run Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

            {/* â”€â”€ Tab 2: Event Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                          <TableCell sx={TD}>{e.event_type}</TableCell>
                          <TableCell sx={TD}>{e.task_id ?? '—'}</TableCell>
                          <TableCell sx={{ ...TD, color: SEVERITY_COLORS[e.severity] || 'inherit', fontWeight: e.severity !== 'info' ? 600 : 400 }}>{e.severity}</TableCell>
                          <TableCell sx={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.detail}>{e.detail}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </TableContainer>
            )}

            {/* â”€â”€ Tab 3: Consistency Check Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', py: 0.75 }}>
              <Button
                size="small"
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon fontSize="small" />}
                disabled={TAB_DATA[tab].length === 0}
                onClick={() => setConfirmClear(true)}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Clear
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FileDownloadIcon fontSize="small" />}
                disabled={TAB_DATA[tab].length === 0}
                onClick={() => exportCsv(TAB_DATA[tab], TAB_CONFIG[tab].cols, TAB_CONFIG[tab].filename)}
                sx={{ fontSize: '0.72rem', textTransform: 'none' }}
              >
                Export CSV
              </Button>
              <Tooltip title="Export all four tables as one Excel workbook (4 sheets)">
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
                    sx={{ fontSize: '0.72rem', textTransform: 'none' }}
                  >
                    Export Excel
                  </Button>
                </span>
              </Tooltip>
            </Box>

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
          </>
        )}
      </Paper>
    </Box>
  );
}

function MetricBadge({ label, value }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 60 }}>
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight="bold" sx={{ lineHeight: 1.4 }}>
        {value}
      </Typography>
    </Box>
  );
}
