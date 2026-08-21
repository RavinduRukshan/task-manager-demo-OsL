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
  const [mode, setMode] = useState('with-library');
  const [userId, setUserId] = useState('alice');
  const [encrypted, setEncrypted] = useState(false);
  const [dbName, setDbName] = useState('offline-sync-lite:alice');
  const [schemaVersion, setSchemaVersion] = useState(1);

  useEffect(() => {
    setMode(dataService.getMode());
    if (dataService.getActiveUserId) {
      setUserId(dataService.getActiveUserId());
    }
    if (dataService.getEncryptionStatus) {
      setEncrypted(dataService.getEncryptionStatus().encrypted);
    }
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

  // Re-subscribe and reload whenever the active adapter or user changes
  useEffect(() => {
    setLoading(true);
    const unsub = dataService.subscribe(({
      records,
      events,
      cycleLogs: nextCycleLogs = [],
      runLogs: nextRunLogs = [],
      consistencyLogs: nextConsistencyLogs = [],
      runActive: nextRunActive = false,
      currentRunId: nextRunId = null,
      userId: nextUserId = 'alice',
      dbName: nextDbName = '',
      schemaVersion: nextSchemaVer = 1,
      encrypted: nextEncrypted = false,
    }) => {
      setTasks(records || []);
      setSyncEvents(events || []);
      setCycleLogs(nextCycleLogs);
      setRunLogs(nextRunLogs);
      setConsistencyLogs(nextConsistencyLogs);
      setRunActive(nextRunActive);
      setCurrentRunId(nextRunId);
      if (nextUserId) setUserId(nextUserId);
      if (nextDbName) setDbName(nextDbName);
      if (nextSchemaVer) setSchemaVersion(nextSchemaVer);
      setEncrypted(Boolean(nextEncrypted));
    });

    dataService
      .list()
      .then((records) => {
        setTasks(records || []);
        setLoading(false);
      })
      .catch((err) => {
        showSnackbar(`Failed to load tasks: ${err.message}`, 'error');
        setLoading(false);
      });

    return unsub;
  }, [mode]);

  function handleModeChange(newMode) {
    dataService.setMode(newMode);
    setMode(newMode);
    showSnackbar(`Switched mode to: ${newMode === 'with-library' ? 'offline-sync-lite SDK' : 'Direct Fetch Baseline'}`);
  }

  async function handleUserChange(newUserId, options = {}) {
    try {
      setLoading(true);
      const res = await dataService.switchUser(newUserId, options);
      setUserId(res.userId || newUserId);
      showSnackbar(`Switched active tenant to '${newUserId}'`);
      const records = await dataService.list();
      setTasks(records || []);
    } catch (err) {
      showSnackbar(`User switch failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetPassphrase(passphrase) {
    try {
      const res = await dataService.setEncryptionPassphrase(passphrase);
      setEncrypted(res.encrypted);
      showSnackbar(res.encrypted ? 'Vault encryption enabled with AES-GCM-256' : 'At-rest encryption disabled');
      const records = await dataService.list();
      setTasks(records || []);
    } catch (err) {
      showSnackbar(`Vault update failed: ${err.message}`, 'error');
    }
  }

  async function handleSeedDemo() {
    try {
      await dataService.seedDemoData();
      showSnackbar('Demo tasks seeded for Alice & Bob');
      const records = await dataService.list();
      setTasks(records || []);
    } catch (err) {
      showSnackbar(`Seed failed: ${err.message}`, 'error');
    }
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
        userId={userId}
        onUserChange={handleUserChange}
        encrypted={encrypted}
        onSetPassphrase={handleSetPassphrase}
        onSeedDemo={handleSeedDemo}
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
                No tasks for tenant &quot;{userId}&quot; — create one or seed demo tasks!
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button variant="contained" onClick={() => router.push('/tasks/new')}>
                  Create Task
                </Button>
                <Button variant="outlined" onClick={handleSeedDemo}>
                  Seed Demo Tasks
                </Button>
              </Box>
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
          setClockOffset={dataService.setClockOffset}
          getSchemaVersion={dataService.getSchemaVersion}
          onMigrate={dataService.migrate}
          onTriggerPoisonPill={dataService.triggerPoisonPill}
          onSimulateSchemaDrift={dataService.simulateSchemaDrift}
          userId={userId}
          dbName={dbName}
          schemaVersion={schemaVersion}
          encrypted={encrypted}
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
