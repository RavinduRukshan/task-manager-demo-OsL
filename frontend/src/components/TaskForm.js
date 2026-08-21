'use client';
import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

const STATUS_OPTIONS = ['open', 'in-progress', 'done'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high'];
const SUGGESTED_TAGS = ['sync', 'urgent', 'bug', 'v0.4.0', 'security', 'frontend', 'backend'];

export default function TaskForm({
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Save',
}) {
  const initialTags = Array.isArray(initialValues.tags)
    ? initialValues.tags
    : (initialValues.tags ? String(initialValues.tags).split(',').map(s => s.trim()).filter(Boolean) : []);

  const [values, setValues] = useState({
    title:       initialValues.title       || '',
    description: initialValues.description || '',
    status:      initialValues.status      || 'open',
    priority:    initialValues.priority    || 'medium',
    assignee:    initialValues.assignee    || '',
    points:      typeof initialValues.points === 'number' ? initialValues.points : (parseInt(initialValues.points, 10) || 3),
    userId:      initialValues.userId      || 'alice',
    poisonPill:  Boolean(initialValues.poisonPill),
  });

  const [tags, setTags] = useState(initialTags);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const errs = {};
    if (!values.title.trim()) errs.title = 'Title is required';
    return errs;
  }

  function handleAddTag(tagToAdd) {
    const t = (tagToAdd || tagInput).trim().toLowerCase().replace(/^#/, '');
    if (t && !tags.includes(t)) {
      setTags((prev) => [...prev, t]);
    }
    setTagInput('');
  }

  function handleRemoveTag(tagToRemove) {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
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
      await onSubmit({
        ...values,
        tags,
        points: parseInt(values.points, 10) || 0,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleChange(field) {
    return (evt) => {
      const val = evt.target.type === 'checkbox' ? evt.target.checked : evt.target.value;
      setValues((prev) => ({ ...prev, [field]: val }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}
    >
      <TextField
        label="Task Title"
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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <FormControl fullWidth size="small">
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

        <FormControl fullWidth size="small">
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
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField
          label="Assignee"
          size="small"
          value={values.assignee}
          onChange={handleChange('assignee')}
          placeholder="e.g. Alice, Bob"
          fullWidth
        />

        <TextField
          label="Story Points / Hours (Field-Merge Demo)"
          type="number"
          size="small"
          value={values.points}
          onChange={handleChange('points')}
          inputProps={{ min: 0, max: 100 }}
          fullWidth
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <TextField
          label="Tenant / Owner User ID"
          size="small"
          value={values.userId}
          onChange={handleChange('userId')}
          helperText="Multi-user partition tenant"
          fullWidth
        />

        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={values.poisonPill}
                onChange={handleChange('poisonPill')}
                color="error"
              />
            }
            label={
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: values.poisonPill ? 'error.main' : 'text.secondary' }}>
                <WarningAmberIcon fontSize="small" /> Simulate Poison Pill (Trigger 422 for DLQ)
              </Typography>
            }
          />
        </Box>
      </Box>

      {/* ── Tags Section (Field-Level Array Union Merge) ── */}
      <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, fontWeight: 600 }}>
          <LocalOfferIcon sx={{ fontSize: '0.9rem' }} /> Tags (Demonstrates Granular Array Union Conflict Resolution)
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField
            size="small"
            label="Add Tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            placeholder="Type tag and press Enter"
            sx={{ flex: 1 }}
          />
          <Button variant="outlined" size="small" onClick={() => handleAddTag()}>
            Add
          </Button>
        </Box>

        {/* Active tags */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
          {tags.length === 0 ? (
            <Typography variant="caption" color="text.disabled">No tags added yet</Typography>
          ) : (
            tags.map((t) => (
              <Chip
                key={t}
                label={`#${t}`}
                size="small"
                color="primary"
                variant="filled"
                onDelete={() => handleRemoveTag(t)}
              />
            ))
          )}
        </Box>

        {/* Suggested tags */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          <Typography variant="caption" color="text.disabled" sx={{ mr: 0.5 }}>Quick:</Typography>
          {SUGGESTED_TAGS.filter((st) => !tags.includes(st)).map((st) => (
            <Chip
              key={st}
              label={`+ ${st}`}
              size="small"
              variant="outlined"
              onClick={() => handleAddTag(st)}
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          ))}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 1 }}>
        <Button variant="outlined" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color={values.poisonPill ? 'error' : 'primary'}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : null}
        >
          {values.poisonPill ? 'Inject Poison Pill' : submitLabel}
        </Button>
      </Box>
    </Box>
  );
}
