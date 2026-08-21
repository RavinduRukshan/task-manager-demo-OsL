'use client';
import { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import AddIcon from '@mui/icons-material/Add';
import SyncIcon from '@mui/icons-material/Sync';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import TabIcon from '@mui/icons-material/Tab';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ShieldIcon from '@mui/icons-material/Shield';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';

const PRESET_USERS = [
  { id: 'alice', label: 'Alice (Tenant A)' },
  { id: 'bob',   label: 'Bob (Tenant B)' },
  { id: 'charlie', label: 'Charlie (Tenant C)' },
];

export default function TopBar({
  mode = 'with-library',
  onModeChange,
  onAddTask,
  onSyncNow,
  userId = 'alice',
  onUserChange,
  encrypted = false,
  onSetPassphrase,
  onSeedDemo,
}) {
  const withLibrary = mode === 'with-library';

  // User menu state
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [customUserOpen, setCustomUserOpen] = useState(false);
  const [customUserId, setCustomUserId] = useState('');
  const [purgeOldOnSwitch, setPurgeOldOnSwitch] = useState(false);

  // Vault encryption dialog state
  const [vaultOpen, setVaultOpen] = useState(false);
  const [passphraseInput, setPassphraseInput] = useState('');

  function handleOpenUserMenu(event) {
    setUserMenuAnchor(event.currentTarget);
  }

  function handleCloseUserMenu() {
    setUserMenuAnchor(null);
  }

  async function handleSelectUser(newId) {
    handleCloseUserMenu();
    if (newId === '__custom__') {
      setCustomUserOpen(true);
      return;
    }
    if (onUserChange) {
      await onUserChange(newId, { purgeOldUser: purgeOldOnSwitch });
    }
  }

  async function handleApplyCustomUser() {
    const trimmed = customUserId.trim();
    if (trimmed && onUserChange) {
      await onUserChange(trimmed, { purgeOldUser: purgeOldOnSwitch });
    }
    setCustomUserOpen(false);
    setCustomUserId('');
  }

  async function handleSaveVaultPassphrase() {
    if (onSetPassphrase) {
      await onSetPassphrase(passphraseInput.trim());
    }
    setVaultOpen(false);
  }

  async function handleClearVault() {
    if (onSetPassphrase) {
      await onSetPassphrase('');
    }
    setPassphraseInput('');
    setVaultOpen(false);
  }

  function handleOpenSecondTab() {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  }

  return (
    <AppBar position="static" elevation={2}>
      <Toolbar sx={{ gap: 1, flexWrap: 'wrap', py: 0.5 }}>
        {/* App Title */}
        <Typography variant="h6" component="div" sx={{ fontWeight: 700, letterSpacing: -0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
          Task Manager
        </Typography>

        <Box sx={{ flexGrow: 1 }} />

        {/* ── Multi-User Tenant Selector ── */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            onClick={handleOpenUserMenu}
            startIcon={<PersonIcon />}
            endIcon={<ArrowDropDownIcon />}
            sx={{
              textTransform: 'none',
              borderColor: 'rgba(255,255,255,0.4)',
              bgcolor: 'rgba(255,255,255,0.08)',
              '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.16)' },
              fontSize: '0.78rem',
              fontWeight: 600,
            }}
          >
            User: {userId}
          </Button>

          <Menu
            anchorEl={userMenuAnchor}
            open={Boolean(userMenuAnchor)}
            onClose={handleCloseUserMenu}
            PaperProps={{ sx: { minWidth: 200, mt: 0.5 } }}
          >
            <Typography variant="caption" sx={{ px: 2, py: 0.5, color: 'text.secondary', fontWeight: 700, display: 'block' }}>
              SWITCH TENANT PARTITION
            </Typography>
            {PRESET_USERS.map((u) => (
              <MenuItem
                key={u.id}
                selected={userId === u.id}
                onClick={() => handleSelectUser(u.id)}
                sx={{ fontSize: '0.8rem' }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <PersonIcon fontSize="small" color={userId === u.id ? 'primary' : 'inherit'} />
                </ListItemIcon>
                <ListItemText primary={u.label} primaryTypographyProps={{ fontSize: '0.8rem', fontWeight: userId === u.id ? 700 : 400 }} />
              </MenuItem>
            ))}
            <MenuItem onClick={() => handleSelectUser('__custom__')} sx={{ fontSize: '0.8rem' }}>
              <ListItemIcon sx={{ minWidth: 30 }}>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Custom Tenant ID..." primaryTypographyProps={{ fontSize: '0.8rem' }} />
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ px: 2, py: 0.5 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={purgeOldOnSwitch}
                    onChange={(e) => setPurgeOldOnSwitch(e.target.checked)}
                  />
                }
                label={<Typography variant="caption" color="text.secondary">Purge old DB on switch</Typography>}
              />
            </Box>
          </Menu>
        </Box>

        {/* ── At-Rest Vault Encryption Toggle / Badge ── */}
        {withLibrary && (
          <Tooltip title={encrypted ? 'At-Rest Storage Encryption ACTIVE (Web Crypto AES-GCM-256)' : 'At-Rest Storage Encryption DISABLED (Click to configure)'}>
            <Chip
              icon={encrypted ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
              label={encrypted ? 'Vault: AES-256' : 'Vault: Plain'}
              size="small"
              onClick={() => setVaultOpen(true)}
              color={encrypted ? 'success' : 'default'}
              variant={encrypted ? 'filled' : 'outlined'}
              sx={{
                cursor: 'pointer',
                fontSize: '0.72rem',
                fontWeight: 600,
                color: encrypted ? 'white' : 'rgba(255,255,255,0.85)',
                borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: 'white' },
              }}
            />
          </Tooltip>
        )}

        {/* ── Multi-Tab Concurrency Launcher ── */}
        <Tooltip title="Open a 2nd tab side-by-side to test Web Locks & real-time BroadcastChannel sync">
          <Button
            size="small"
            color="inherit"
            variant="outlined"
            startIcon={<TabIcon />}
            onClick={handleOpenSecondTab}
            sx={{
              borderColor: 'rgba(255,255,255,0.4)',
              '&:hover': { borderColor: 'white' },
              textTransform: 'none',
              fontSize: '0.75rem',
            }}
          >
            2nd Tab
          </Button>
        </Tooltip>

        {/* ── Seed Demo Tasks ── */}
        {onSeedDemo && (
          <Tooltip title="Seed multi-user test tasks for Alice and Bob">
            <Button
              size="small"
              color="inherit"
              variant="outlined"
              startIcon={<AutoAwesomeIcon />}
              onClick={onSeedDemo}
              sx={{
                borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: 'white' },
                textTransform: 'none',
                fontSize: '0.75rem',
              }}
            >
              Seed
            </Button>
          </Tooltip>
        )}

        {/* ── Mode Toggle (offline-sync-lite vs Direct Fetch) ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            color: 'inherit',
            mx: 0.5,
            gap: 0.5,
            whiteSpace: 'nowrap',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: 0.2 }}>
            SDK
          </Typography>
          <Switch
            checked={withLibrary}
            onChange={(e) => onModeChange && onModeChange(e.target.checked ? 'with-library' : 'without-library')}
            size="small"
            inputProps={{ 'aria-label': 'offline-sync-lite mode toggle' }}
            sx={{
              width: 44,
              height: 24,
              p: 0,
              '& .MuiSwitch-switchBase': {
                p: 0.4,
                transitionDuration: '220ms',
                '&.Mui-checked': {
                  transform: 'translateX(20px)',
                  color: '#0f2657',
                  '& + .MuiSwitch-track': {
                    bgcolor: 'rgba(255,255,255,0.4)',
                    opacity: 1,
                    borderColor: 'rgba(255,255,255,0.85)',
                  },
                },
              },
              '& .MuiSwitch-thumb': {
                width: 16,
                height: 16,
                bgcolor: '#f4f8ff',
              },
              '& .MuiSwitch-track': {
                borderRadius: 12,
                opacity: 1,
                bgcolor: 'rgba(8, 19, 46, 0.45)',
                border: '1.5px solid rgba(255,255,255,0.7)',
              },
            }}
          />
        </Box>

        {/* ── Sync Now ── */}
        <Button
          color="inherit"
          startIcon={<SyncIcon />}
          onClick={onSyncNow}
          size="small"
          sx={{ fontSize: '0.75rem', textTransform: 'none' }}
        >
          Sync Now
        </Button>

        {/* ── Add Task ── */}
        <Button
          color="inherit"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAddTask}
          size="small"
          sx={{
            bgcolor: 'rgba(255,255,255,0.2)',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' },
            fontSize: '0.75rem',
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Add Task
        </Button>
      </Toolbar>

      {/* ── Custom Tenant ID Dialog ── */}
      <Dialog open={customUserOpen} onClose={() => setCustomUserOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem' }}>Switch Tenant Partition</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ fontSize: '0.8rem', mb: 2 }}>
            Enter a unique Tenant / User ID. IndexedDB tables, operation queues, Web Locks, and BroadcastChannels will isolate automatically.
          </DialogContentText>
          <TextField
            autoFocus
            size="small"
            label="Tenant / User ID"
            value={customUserId}
            onChange={(e) => setCustomUserId(e.target.value)}
            fullWidth
            placeholder="e.g. user_789"
          />
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setCustomUserOpen(false)}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleApplyCustomUser}>Switch</Button>
        </DialogActions>
      </Dialog>

      {/* ── Vault Encryption Passphrase Dialog ── */}
      <Dialog open={vaultOpen} onClose={() => setVaultOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShieldIcon color="primary" fontSize="small" />
          At-Rest Vault Encryption (Web Crypto)
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <DialogContentText sx={{ fontSize: '0.8rem', mb: 2 }}>
            Protect local IndexedDB records and queued mutations with hardware-accelerated <strong>AES-GCM-256</strong> envelope encryption derived via PBKDF2 (100,000 iterations).
          </DialogContentText>
          <TextField
            autoFocus
            type="password"
            size="small"
            label="Encryption Passphrase / PIN"
            value={passphraseInput}
            onChange={(e) => setPassphraseInput(e.target.value)}
            fullWidth
            placeholder="Enter passphrase to encrypt disk storage"
            helperText={encrypted ? 'Vault is currently active. Change passphrase or leave blank to disable.' : 'Enter a master passphrase to enable at-rest envelope encryption.'}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {encrypted && (
            <Button size="small" color="error" onClick={handleClearVault} sx={{ mr: 'auto', textTransform: 'none' }}>
              Disable Encryption
            </Button>
          )}
          <Button size="small" onClick={() => setVaultOpen(false)}>Cancel</Button>
          <Button size="small" variant="contained" onClick={handleSaveVaultPassphrase}>
            Save Vault Key
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}
