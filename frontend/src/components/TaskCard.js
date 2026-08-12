'use client';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

// Status → MUI color mapping  (open=blue, in-progress=orange, done=green)
const STATUS_COLOR = {
  open: 'primary',
  'in-progress': 'warning',
  done: 'success',
};

// Priority → MUI color mapping  (low=default/grey, medium=warning/yellow, high=error/red)
const PRIORITY_COLOR = {
  low: 'default',
  medium: 'warning',
  high: 'error',
};

export default function TaskCard({ task, onEdit, onDelete }) {
  const { data, updatedAt, serverVersion } = task;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Typography variant="h6" gutterBottom noWrap title={data.title}>
          {data.title}
        </Typography>

        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          <Chip
            label={data.status}
            color={STATUS_COLOR[data.status] || 'default'}
            size="small"
          />
          <Chip
            label={data.priority}
            color={PRIORITY_COLOR[data.priority] || 'default'}
            size="small"
            variant="outlined"
          />
        </Box>

        {data.assignee && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            <strong>Assignee:</strong> {data.assignee}
          </Typography>
        )}

        {data.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {data.description}
          </Typography>
        )}

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 1.5, display: 'block' }}
        >
          Updated: {new Date(updatedAt).toLocaleString()} · v{serverVersion}
        </Typography>
      </CardContent>

      <Divider />

      <CardActions sx={{ justifyContent: 'flex-end', px: 1, py: 0.5 }}>
        <Button size="small" startIcon={<EditIcon />} onClick={onEdit}>
          Edit
        </Button>
        <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}
