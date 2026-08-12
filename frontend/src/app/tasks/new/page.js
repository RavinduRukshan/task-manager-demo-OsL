'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { v4 as uuidv4 } from 'uuid';

import TaskForm from '../../../components/TaskForm';
import * as dataService from '../../../services/dataService';

export default function NewTaskPage() {
  const router = useRouter();
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  async function handleSubmit(values) {
    const id = uuidv4();
    await dataService.create({ id, ...values });
    setSnackbar({ open: true, message: 'Task created successfully!', severity: 'success' });
    setTimeout(() => router.push('/tasks'), 1000);
  }

  function handleError(err) {
    setSnackbar({ open: true, message: `Error: ${err.message}`, severity: 'error' });
  }

  async function safeSubmit(values) {
    try {
      await handleSubmit(values);
    } catch (err) {
      handleError(err);
    }
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
        Create New Task
      </Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <TaskForm
          onSubmit={safeSubmit}
          onCancel={() => router.push('/tasks')}
          submitLabel="Create Task"
        />
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
