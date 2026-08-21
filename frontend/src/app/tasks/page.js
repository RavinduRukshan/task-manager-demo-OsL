'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

import TopBar from '../../components/TopBar';
import TaskCard from '../../components/TaskCard';
import SyncMonitorPanel from '../../components/SyncMonitorPanel';
import * as dataService from '../../services/dataService';

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('without-library');

  useEffect(() => {
    setMode(dataService.getMode());
  }, []);
  const [syncEvents, setSyncEvents] = useState([]);
  const [cycleLogs, setCycleLogs] = useState([]);
  const [runLogs, setRunLogs] = useState([]);
  const [consistencyLogs, setConsistencyLogs] = useState([]);
  const [runActive, setRunActive] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [scenarioId, setScenarioId] = useState('N/A');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  function showSnackbar(message, severity = 'success') {
    setSnackbar({ open: true, message, severity });
  }

  function closeSnackbar() {
    setSnackbar((prev) => ({ ...prev, open: false }));
  }

  // Re-subscribe and reload whenever the active adapter changes
  useEffect(() => {
    setLoading(true);
    const unsub = dataService.subscribe(({ records, events, cycleLogs: nextCycleLogs = [], runLogs: nextRunLogs = [], consistencyLogs: nextConsistencyLogs = [], runActive: nextRunActive = false, currentRunId: nextRunId = null }) => {
      setTasks(records);
      setSyncEvents(events);
      setCycleLogs(nextCycleLogs);
      setRunLogs(nextRunLogs);
      setConsistencyLogs(nextConsistencyLogs);
      setRunActive(nextRunActive);
      setCurrentRunId(nextRunId);
    });
    dataService
      .list()
      .then(() => setLoading(false))
      .catch((err) => {
        showSnackbar(`Failed to load tasks: ${err.message}`, 'error');
        setLoading(false);
      });
    return unsub;
  }, [mode]);

  function handleModeChange(newMode) {
    dataService.setMode(newMode);
    setMode(newMode);
  }

  async function handleDelete(id) {
    try {
      await dataService.remove(id);
      showSnackbar('Task deleted successfully');
    } catch (err) {
      showSnackbar(`Delete failed: ${err.message}`, 'error');
    }
  }

  const handleSyncNow = useCallback(async () => {
    const result = await dataService.syncNow('manual');
    showSnackbar(
      result.ok ? 'Sync complete' : 'Sync failed',
      result.ok ? 'success' : 'error',
    );
  }, []);

  function handleScenarioChange(id) {
    dataService.setScenarioId(id);
    setScenarioId(id);
  }

  function handleStartRun(sid) { dataService.startRun(sid); }
  async function handleEndRun() { await dataService.endRun(); }
  async function handleCheckConsistency() { await dataService.checkConsistency(); }
  function handleClearLogs(target) { dataService.clearLogs(target); }

  async function handlePruneCache(maxRecords) {
    try {
      const result = await dataService.pruneCache(maxRecords);
      showSnackbar(`Pruned ${result.pruned} task(s), ${result.kept} remaining in cache`);
    } catch (err) {
      showSnackbar(`Prune failed: ${err.message}`, 'error');
    }
  }

  async function handleClearCache() {
    try {
      await dataService.clearCache();
      showSnackbar('Local cache cleared (unsynced operations preserved)');
    } catch (err) {
      showSnackbar(`Clear cache failed: ${err.message}`, 'error');
    }
  }

  async function handleRetryDeadLetterOp(opKey) {
    try {
      await dataService.retryDeadLetterOp(opKey);
      showSnackbar('Re-queued operation for next sync');
    } catch (err) {
      showSnackbar(`Retry failed: ${err.message}`, 'error');
    }
  }

  async function handleDiscardDeadLetterOps() {
    try {
      const result = await dataService.discardDeadLetterOps();
      showSnackbar(`Discarded ${result.discarded} dead-letter operation(s)`);
    } catch (err) {
      showSnackbar(`Discard failed: ${err.message}`, 'error');
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}
    >
      <TopBar
        mode={mode}
        onModeChange={handleModeChange}
        onAddTask={() => router.push('/tasks/new')}
        onSyncNow={handleSyncNow}
      />

      <Box sx={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, p: 3, overflowY: 'auto', overflowX: 'hidden' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 10 }}>
              <CircularProgress />
            </Box>
          ) : tasks.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                mt: 10,
                gap: 2,
              }}
            >
              <AddCircleOutlineIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
              <Typography variant="h6" color="text.secondary">
                No tasks yet — create your first one!
              </Typography>
              <Button variant="contained" onClick={() => router.push('/tasks/new')}>
                Create Task
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {tasks.map((task) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={task.id}>
                  <TaskCard
                    task={task}
                    onEdit={() => router.push(`/tasks/${task.id}/edit`)}
                    onDelete={() => handleDelete(task.id)}
                  />
                </Grid>
              ))}
            </Grid>
          )}
        </Box>

        <SyncMonitorPanel
          rightDock
          mode={mode}
          onSyncNow={handleSyncNow}
          onStartAutoSync={dataService.startAutoSync}
          onStopAutoSync={dataService.stopAutoSync}
          onPauseSync={dataService.pauseSync}
          onResumeSync={dataService.resumeSync}
          onPruneCache={handlePruneCache}
          onClearCache={handleClearCache}
          onGetDeadLetterOps={dataService.getDeadLetterOps}
          onRetryDeadLetterOp={handleRetryDeadLetterOp}
          onDiscardDeadLetterOps={handleDiscardDeadLetterOps}
          getClockOffset={dataService.getClockOffset}
          getMetrics={dataService.getMetrics}
          syncEvents={syncEvents}
          cycleLogs={cycleLogs}
          runLogs={runLogs}
          consistencyLogs={consistencyLogs}
          runActive={runActive}
          currentRunId={currentRunId}
          scenarioId={scenarioId}
          onScenarioChange={handleScenarioChange}
          onStartRun={handleStartRun}
          onEndRun={handleEndRun}
          onCheckConsistency={handleCheckConsistency}
          onClearLogs={handleClearLogs}
        />
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={closeSnackbar} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
