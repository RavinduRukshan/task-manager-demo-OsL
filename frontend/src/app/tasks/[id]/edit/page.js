'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

import TaskForm from '../../../../components/TaskForm';
import * as dataService from '../../../../services/dataService';

export default function EditTaskPage() {
  const router = useRouter();
  const { id } = useParams();

  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    dataService
      .get(id)
      .then((record) => {
        setTask(record);
        setLoading(false);
      })
      .catch((err) => {
        setSnackbar({ open: true, message: err.message, severity: 'error' });
        setLoading(false);
      });
  }, [id]);

  async function handleSubmit(values) {
    try {
      await dataService.update(id, values);
      setSnackbar({ open: true, message: 'Task updated successfully!', severity: 'success' });
      setTimeout(() => router.push('/tasks'), 1000);
    } catch (err) {
      setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: 3,
        maxWidth: 640,
        mx: 'auto',
        minHeight: '100vh',
        bgcolor: 'background.default',
      }}
    >
      <Typography variant="h5" fontWeight="bold" gutterBottom>
        Edit Task
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        {task?.data ? (
          <TaskForm
            initialValues={task.data}
            onSubmit={handleSubmit}
            onCancel={() => router.push('/tasks')}
            submitLabel="Update Task"
          />
        ) : task ? (
          <Alert severity="warning">
            This task is encrypted at rest. Please enter your Vault passphrase in the top bar to edit it.
          </Alert>
        ) : (
          <Alert severity="error">Task not found.</Alert>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
