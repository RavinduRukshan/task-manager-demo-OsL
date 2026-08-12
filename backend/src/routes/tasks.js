const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * Transforms a database row into the shared task record shape.
 */
function formatTask(row) {
  return {
    id: row.id,
    data: {
      title: row.title,
      description: row.description || '',
      status: row.status,
      priority: row.priority,
      assignee: row.assignee || '',
    },
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at,
    serverVersion: row.server_version,
  };
}

// ─── POST /api/tasks/batch ────────────────────────────────────────────────────
// Must be defined BEFORE /:id to prevent Express matching "batch" as an id.
router.post('/batch', async (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations must be an array' });
  }

  const results = [];

  for (const op of operations) {
    try {
      if (op.type === 'create') {
        const { id, payload } = op;
        const src = payload.data || payload;
        const { title, description = '', status = 'open', priority = 'medium', assignee = '' } = src;
        if (!id || !title) {
          results.push({ success: false, error: 'id and title are required' });
          continue;
        }
        const result = await db.query(
          `INSERT INTO tasks (id, title, description, status, priority, assignee, updated_at, server_version)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
           RETURNING *`,
          [id, title, description, status, priority, assignee]
        );
        results.push({ success: true, record: formatTask(result.rows[0]) });

      } else if (op.type === 'update') {
        const { id, payload } = op;
        const patch = payload.patch || payload.data || payload;
        const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
          results.push({ success: false, error: 'Task not found' });
          continue;
        }
        const row = existing.rows[0];
        const updated = {
          title:       patch.title       ?? row.title,
          description: patch.description ?? row.description,
          status:      patch.status      ?? row.status,
          priority:    patch.priority    ?? row.priority,
          assignee:    patch.assignee    ?? row.assignee,
        };
        const result = await db.query(
          `UPDATE tasks
           SET title=$1, description=$2, status=$3, priority=$4, assignee=$5,
               updated_at=NOW(), server_version=server_version+1
           WHERE id=$6 RETURNING *`,
          [updated.title, updated.description, updated.status, updated.priority, updated.assignee, id]
        );
        results.push({ success: true, record: formatTask(result.rows[0]) });

      } else if (op.type === 'delete') {
        await db.query('DELETE FROM tasks WHERE id = $1', [op.id]);
        results.push({ success: true });

      } else {
        results.push({ success: false, error: `Unknown operation type: ${op.type}` });
      }
    } catch (err) {
      results.push({ success: false, error: err.message });
    }
  }

  res.json({ results });
});

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { since } = req.query;
    let result;
    if (since) {
      result = await db.query(
        'SELECT * FROM tasks WHERE updated_at > $1 ORDER BY created_at ASC',
        [new Date(since)]
      );
    } else {
      result = await db.query('SELECT * FROM tasks ORDER BY created_at ASC');
    }
    res.json({
      records: result.rows.map(formatTask),
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(formatTask(result.rows[0]));
  } catch (err) {
    console.error('GET /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { id } = req.body;
    const src = req.body.data || req.body;
    const { title, description = '', status = 'open', priority = 'medium', assignee = '' } = src;
    if (!id || !title) {
      return res.status(400).json({ error: 'id and title are required' });
    }
    const result = await db.query(
      `INSERT INTO tasks (id, title, description, status, priority, assignee, updated_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 1)
       RETURNING *`,
      [id, title, description, status, priority, assignee]
    );
    res.status(201).json(formatTask(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A task with this ID already exists' });
    }
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { patch, updatedAt } = req.body;
    const { id } = req.params;

    const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const row = existing.rows[0];

    // Conflict detection: server record is newer than the client's baseline
    if (updatedAt && new Date(row.updated_at) > new Date(updatedAt)) {
      return res.status(409).json({
        error: 'conflict',
        remoteRecord: formatTask(row),
      });
    }

    const updated = {
      title:       patch.title       ?? row.title,
      description: patch.description ?? row.description,
      status:      patch.status      ?? row.status,
      priority:    patch.priority    ?? row.priority,
      assignee:    patch.assignee    ?? row.assignee,
    };

    const result = await db.query(
      `UPDATE tasks
       SET title=$1, description=$2, status=$3, priority=$4, assignee=$5,
           updated_at=NOW(), server_version=server_version+1
       WHERE id=$6 RETURNING *`,
      [updated.title, updated.description, updated.status, updated.priority, updated.assignee, id]
    );

    res.json(formatTask(result.rows[0]));
  } catch (err) {
    console.error('PATCH /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
