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

import LockIcon from '@mui/icons-material/Lock';

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
  const isLocked = !data;
  const tags = Array.isArray(data?.tags) ? data.tags : [];
  const points = typeof data?.points === 'number' ? data.points : 0;
  const userId = data?.userId || '';
  const title = data?.title || (isLocked ? 'Encrypted Task' : 'Untitled Task');
  const status = data?.status || 'open';
  const priority = data?.priority || 'low';
  const assignee = data?.assignee || '';
  const description = data?.description || '';

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
        ...(isLocked && {
          bgcolor: 'rgba(255, 152, 0, 0.04)',
          border: '1px dashed rgba(255, 152, 0, 0.4)',
        }),
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          <Typography
            variant="subtitle1"
            fontWeight="bold"
            noWrap
            title={title}
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: isLocked ? 'warning.main' : 'inherit',
            }}
          >
            {isLocked && <LockIcon fontSize="small" color="warning" />}
            {title}
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

        {isLocked ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', my: 1, fontStyle: 'italic' }}>
            Encrypted with AES-256 at rest. Enter your Vault passphrase in the top bar to decrypt.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
              <Chip
                label={status}
                color={STATUS_COLOR[status] || 'default'}
                size="small"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              <Chip
                label={priority}
                color={PRIORITY_COLOR[priority] || 'default'}
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

            {assignee && (
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.5 }}>
                <strong>Assignee:</strong> {assignee}
              </Typography>
            )}

            {description && (
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
                {description}
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
          </>
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
        {!isLocked && (
          <Button size="small" startIcon={<EditIcon sx={{ fontSize: '0.85rem !important' }} />} onClick={onEdit} sx={{ fontSize: '0.72rem', textTransform: 'none' }}>
            Edit
          </Button>
        )}
        <Button size="small" color="error" startIcon={<DeleteIcon sx={{ fontSize: '0.85rem !important' }} />} onClick={onDelete} sx={{ fontSize: '0.72rem', textTransform: 'none' }}>
          Delete
        </Button>
      </CardActions>
    </Card>
  );
}
