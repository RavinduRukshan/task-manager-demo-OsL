'use client';
import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

const STATUS_OPTIONS = ['open', 'in-progress', 'done'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];

export default function TaskForm({
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}) {
  const [values, setValues] = useState({
    title:       initialValues.title       || '',
    description: initialValues.description || '',
    status:      initialValues.status      || 'open',
    priority:    initialValues.priority    || 'medium',
    assignee:    initialValues.assignee    || '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!values.title.trim()) errs.title = 'Title is required';
    return errs;
  }

  async function handleSubmit(evt) {
    evt.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field) {
    return (evt) => {
      const val = evt.target.value;
      setValues((prev) => ({ ...prev, [field]: val }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}
    >
      <TextField
        label="Title"
        required
        value={values.title}
        onChange={handleChange('title')}
        error={!!errors.title}
        helperText={errors.title}
        fullWidth
        autoFocus
      />

      <TextField
        label="Description"
        value={values.description}
        onChange={handleChange('description')}
        multiline
        rows={3}
        fullWidth
      />

      <FormControl fullWidth>
        <InputLabel id="status-label">Status</InputLabel>
        <Select
          labelId="status-label"
          value={values.status}
          label="Status"
          onChange={handleChange('status')}
        >
          {STATUS_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="priority-label">Priority</InputLabel>
        <Select
          labelId="priority-label"
          value={values.priority}
          label="Priority"
          onChange={handleChange('priority')}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <MenuItem key={p} value={p}>
              {p}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <TextField
        label="Assignee"
        value={values.assignee}
        onChange={handleChange('assignee')}
        fullWidth
      />

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 1 }}>
        <Button variant="outlined" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {submitLabel}
        </Button>
      </Box>
    </Box>
  );
}
