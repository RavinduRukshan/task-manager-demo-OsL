'use client';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';

export default function TopBar({ mode, onModeChange, onAddTask, onSyncNow }) {
  const withLibrary = mode === 'with-library';

  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 1 }}>
        <Typography variant="h6" component="div" sx={{ fontWeight: 700 }}>
          Task Manager
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
            mr: 1.5,
            gap: 0.7,
            whiteSpace: 'nowrap',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, letterSpacing: 0.2 }}>
            offline-sync-lite
          </Typography>
          <Switch
            checked={withLibrary}
            onChange={(e) => onModeChange(e.target.checked ? 'with-library' : 'without-library')}
            size="small"
            inputProps={{ 'aria-label': 'offline-sync-lite mode toggle' }}
            sx={{
              width: 46,
              height: 26,
              p: 0,
              '& .MuiSwitch-switchBase': {
                p: 0.5,
                transitionDuration: '220ms',
                '&.Mui-checked': {
                  transform: 'translateX(20px)',
                  color: '#0f2657',
                  '& + .MuiSwitch-track': {
                    bgcolor: 'rgba(255,255,255,0.34)',
                    opacity: 1,
                    borderColor: 'rgba(255,255,255,0.78)',
                  },
                },
              },
              '& .MuiSwitch-thumb': {
                boxSizing: 'border-box',
                width: 18,
                height: 18,
                bgcolor: '#f4f8ff',
                border: '2px solid #0f2657',
              },
              '& .MuiSwitch-track': {
                borderRadius: 13,
                opacity: 1,
                bgcolor: 'rgba(8, 19, 46, 0.45)',
                border: '2px solid rgba(255,255,255,0.78)',
              },
            }}
          />
          <Typography variant="body2" sx={{ minWidth: 22, fontWeight: 600 }}>
            {withLibrary ? 'on' : 'off'}
          </Typography>
        </Box>

        <Button
          color="inherit"
          startIcon={<SyncIcon />}
          onClick={onSyncNow}
          size="small"
          sx={{ mr: 1 }}
        >
          Sync Now
        </Button>

        <Button
          color="inherit"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={onAddTask}
          size="small"
          sx={{ borderColor: 'rgba(255,255,255,0.5)', '&:hover': { borderColor: 'white' } }}
        >
          Add Task
        </Button>
      </Toolbar>
    </AppBar>
  );
}
