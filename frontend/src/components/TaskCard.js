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
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import BoltIcon from '@mui/icons-material/Bolt';

// Status → MUI color mapping (open=blue, in-progress=orange, done=green)
const STATUS_COLOR = {
  open: 'primary',
  'in-progress': 'warning',
  done: 'success',
};

// Priority → MUI color mapping (low=default/grey, medium=warning/yellow, high=error/red)
const PRIORITY_COLOR = {
  low: 'default',
  medium: 'warning',
  high: 'error',
};

export default function TaskCard({ task, onEdit, onDelete }) {
  const { data, updatedAt, serverVersion } = task;
  const tags = Array.isArray(data?.tags) ? data.tags : [];
  const points = typeof data?.points === 'number' ? data.points : 0;
  const userId = data?.userId || 'alice';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 1,
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 3,
        },
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          <Typography variant="subtitle1" fontWeight="bold" noWrap title={data.title} sx={{ flex: 1 }}>
            {data.title}
          </Typography>
          {points > 0 && (
            <Chip
              icon={<BoltIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${points} pt`}
              size="small"
              variant="outlined"
              color="info"
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
          <Chip
            label={data.status}
            color={STATUS_COLOR[data.status] || 'default'}
            size="small"
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          <Chip
            label={data.priority}
            color={PRIORITY_COLOR[data.priority] || 'default'}
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          {userId && (
            <Chip
              icon={<PersonOutlineIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={userId}
              size="small"
              variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem', color: 'text.secondary' }}
            />
          )}
        </Box>

        {data.assignee && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
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
              fontSize: '0.8rem',
              mb: 1,
            }}
          >
            {data.description}
          </Typography>
        )}

        {/* ── Tags display ── */}
        {tags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, my: 0.75 }}>
            {tags.map((t) => (
              <Chip
                key={t}
                label={`#${t}`}
                size="small"
                variant="outlined"
                color="secondary"
                sx={{ height: 18, fontSize: '0.65rem', borderRadius: 0.5 }}
              />
            ))}
          </Box>
        )}

        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mt: 1, display: 'block', fontSize: '0.68rem' }}
        >
          Updated: {updatedAt ? new Date(updatedAt).toLocaleTimeString() : 'local'} · v{serverVersion ?? 1}
        </Typography>
      </CardContent>

      <Divider />

      <CardActions sx={{ justifyContent: 'flex-end', px: 1, py: 0.4 }}>
        <Button size="small" startIcon={<EditIcon sx={{ fontSize: '0.85rem !important' }} />} onClick={onEdit} sx={{ fontSize: '0.72rem', textTransform: 'none' }}>
          Edit
        </Button>
        <Button size="small" color="error" startIcon={<DeleteIcon sx={{ fontSize: '0.85rem !important' }} />} onClick={onDelete} sx={{ fontSize: '0.72rem', textTransform: 'none' }}>
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}
