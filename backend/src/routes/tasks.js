const express = require('express');
const router = express.Router();
const db = require('../db');

// Server schema version (can be dynamically toggled via /config/schema-version for drift simulation)
let serverSchemaVersion = 1;

/**
 * Middleware to attach schema version and server time headers to all task responses.
 */
router.use((req, res, next) => {
  res.set('x-schema-version', String(serverSchemaVersion));
  res.set('Date', new Date().toUTCString());
  next();
});

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
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
      points: typeof row.points === 'number' ? row.points : (parseInt(row.points, 10) || 0),
      userId: row.user_id || 'default',
    },
    updatedAt: row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : row.updated_at,
    serverVersion: row.server_version,
  };
}

// ─── Configuration & Simulation Endpoints ─────────────────────────────────────

router.get('/config/schema-version', (req, res) => {
  res.json({
    schemaVersion: serverSchemaVersion,
    serverTime: new Date().toISOString(),
  });
});

router.post('/config/schema-version', (req, res) => {
  const { schemaVersion } = req.body;
  if (typeof schemaVersion === 'number' && !isNaN(schemaVersion)) {
    serverSchemaVersion = schemaVersion;
  }
  res.json({
    schemaVersion: serverSchemaVersion,
    message: `Server schema version updated to ${serverSchemaVersion}`,
    serverTime: new Date().toISOString(),
  });
});

router.post('/config/seed', async (req, res) => {
  try {
    const seedTasks = [
      {
        id: 'seed-task-1',
        title: 'Review offline-sync-lite architecture',
        description: 'Verify encryption, multi-tab coordination and schema migrations.',
        status: 'in-progress',
        priority: 'high',
        assignee: 'Alice',
        tags: ['architecture', 'sync', 'v0.4.0'],
        points: 5,
        userId: 'alice',
      },
      {
        id: 'seed-task-2',
        title: 'Test Web Crypto AES-GCM at-rest encryption',
        description: 'Check IndexedDB storage inspector for ciphertext envelopes.',
        status: 'open',
        priority: 'medium',
        assignee: 'Alice',
        tags: ['security', 'crypto'],
        points: 3,
        userId: 'alice',
      },
      {
        id: 'seed-task-3',
        title: 'Test cross-tab Web Locks mutual exclusion',
        description: 'Open duplicate browser tabs and trigger simultaneous syncs.',
        status: 'open',
        priority: 'high',
        assignee: 'Bob',
        tags: ['concurrency', 'web-locks'],
        points: 4,
        userId: 'bob',
      },
      {
        id: 'seed-task-4',
        title: 'Validate Dead-Letter Queue poison pill quarantine',
        description: 'Inject 422 Unprocessable Entity payload and inspect DLQ table.',
        status: 'done',
        priority: 'low',
        assignee: 'Bob',
        tags: ['dlq', 'resilience'],
        points: 2,
        userId: 'bob',
      },
    ];

    for (const t of seedTasks) {
      await db.query(
        `INSERT INTO tasks (id, title, description, status, priority, assignee, tags, points, user_id, updated_at, server_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 1)
         ON CONFLICT (id) DO UPDATE
         SET title=$2, description=$3, status=$4, priority=$5, assignee=$6, tags=$7, points=$8, user_id=$9, updated_at=NOW()`,
        [t.id, t.title, t.description, t.status, t.priority, t.assignee, t.tags, t.points, t.userId]
      );
    }

    res.json({ success: true, count: seedTasks.length, message: 'Sample tasks seeded successfully.' });
  } catch (err) {
    console.error('Seed error:', err);
    res.status(500).json({ error: 'Failed to seed database', detail: err.message });
  }
});

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
        const {
          title,
          description = '',
          status = 'open',
          priority = 'medium',
          assignee = '',
          tags = [],
          points = 0,
          userId = 'default',
          poisonPill = false,
        } = src;

        // Intentional poison pill check for DLQ quarantine testing
        if (poisonPill === true || title === '__POISON_PILL__' || (title && title.toLowerCase().includes('poison'))) {
          results.push({
            success: false,
            status: 422,
            error: 'Unprocessable Entity: Poison pill validation failed (non-retryable client error)',
          });
          continue;
        }

        if (!id || !title) {
          results.push({ success: false, status: 400, error: 'id and title are required' });
          continue;
        }

        const cleanTags = Array.isArray(tags) ? tags : [];
        const cleanPoints = typeof points === 'number' ? points : (parseInt(points, 10) || 0);

        const result = await db.query(
          `INSERT INTO tasks (id, title, description, status, priority, assignee, tags, points, user_id, updated_at, server_version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 1)
           RETURNING *`,
          [id, title, description, status, priority, assignee, cleanTags, cleanPoints, userId]
        );
        results.push({ success: true, record: formatTask(result.rows[0]) });

      } else if (op.type === 'update') {
        const { id, payload } = op;
        const patch = payload.patch || payload.data || payload;

        // Intentional poison pill check
        if (patch.poisonPill === true || patch.title === '__POISON_PILL__') {
          results.push({
            success: false,
            status: 422,
            error: 'Unprocessable Entity: Poison pill validation failed (non-retryable client error)',
          });
          continue;
        }

        const existing = await db.query('SELECT * FROM tasks WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
          results.push({ success: false, status: 404, error: 'Task not found' });
          continue;
        }
        const row = existing.rows[0];
        const updated = {
          title:       patch.title       ?? row.title,
          description: patch.description ?? row.description,
          status:      patch.status      ?? row.status,
          priority:    patch.priority    ?? row.priority,
          assignee:    patch.assignee    ?? row.assignee,
          tags:        patch.tags        ?? row.tags ?? [],
          points:      patch.points      ?? row.points ?? 0,
          user_id:     patch.userId      ?? row.user_id ?? 'default',
        };
        const result = await db.query(
          `UPDATE tasks
           SET title=$1, description=$2, status=$3, priority=$4, assignee=$5, tags=$6, points=$7, user_id=$8,
               updated_at=NOW(), server_version=server_version+1
           WHERE id=$9 RETURNING *`,
          [updated.title, updated.description, updated.status, updated.priority, updated.assignee, updated.tags, updated.points, updated.user_id, id]
        );
        results.push({ success: true, record: formatTask(result.rows[0]) });

      } else if (op.type === 'delete') {
        await db.query('DELETE FROM tasks WHERE id = $1', [op.id]);
        results.push({ success: true });

      } else {
        results.push({ success: false, status: 400, error: `Unknown operation type: ${op.type}` });
      }
    } catch (err) {
      results.push({ success: false, status: 500, error: err.message });
    }
  }

  res.json({ results });
});

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { since, userId } = req.query;
    const headerUserId = req.headers['x-user-id'];
    const effectiveUserId = userId || headerUserId;

    let queryText = 'SELECT * FROM tasks';
    const params = [];
    const conditions = [];

    if (since) {
      params.push(new Date(since));
      conditions.push(`updated_at > $${params.length}`);
    }

    if (effectiveUserId && effectiveUserId !== 'all') {
      params.push(effectiveUserId);
      conditions.push(`user_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += ' WHERE ' + conditions.join(' AND ');
    }

    queryText += ' ORDER BY created_at ASC';

    const result = await db.query(queryText, params);

    res.json({
      records: result.rows.map(formatTask),
      serverTime: new Date().toISOString(),
      schemaVersion: serverSchemaVersion,
    });
  } catch (err) {
    console.error('GET /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks', detail: err.message });
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
    const {
      title,
      description = '',
      status = 'open',
      priority = 'medium',
      assignee = '',
      tags = [],
      points = 0,
      userId = 'default',
      poisonPill = false,
    } = src;

    // Intentional poison pill check for DLQ quarantine testing
    if (poisonPill === true || title === '__POISON_PILL__' || (title && title.toLowerCase().includes('poison'))) {
      return res.status(422).json({
        error: 'Unprocessable Entity: Poison pill validation failed (non-retryable client error)',
        code: 'POISON_PILL_ERROR',
      });
    }

    if (!id || !title) {
      return res.status(400).json({ error: 'id and title are required' });
    }

    const cleanTags = Array.isArray(tags) ? tags : [];
    const cleanPoints = typeof points === 'number' ? points : (parseInt(points, 10) || 0);

    const result = await db.query(
      `INSERT INTO tasks (id, title, description, status, priority, assignee, tags, points, user_id, updated_at, server_version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), 1)
       RETURNING *`,
      [id, title, description, status, priority, assignee, cleanTags, cleanPoints, userId]
    );
    res.status(201).json(formatTask(result.rows[0]));
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'A task with this ID already exists' });
    }
    console.error('POST /api/tasks error:', err);
    res.status(500).json({ error: 'Failed to create task', detail: err.message });
  }
});

// ─── PATCH /api/tasks/:id ─────────────────────────────────────────────────────
router.patch('/:id', async (req, res) => {
  try {
    const { patch, updatedAt } = req.body;
    const { id } = req.params;

    // Intentional poison pill check
    if (patch?.poisonPill === true || patch?.title === '__POISON_PILL__') {
      return res.status(422).json({
        error: 'Unprocessable Entity: Poison pill validation failed (non-retryable client error)',
        code: 'POISON_PILL_ERROR',
      });
    }

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
      tags:        patch.tags        ?? row.tags ?? [],
      points:      patch.points      ?? row.points ?? 0,
      user_id:     patch.userId      ?? row.user_id ?? 'default',
    };

    const result = await db.query(
      `UPDATE tasks
       SET title=$1, description=$2, status=$3, priority=$4, assignee=$5, tags=$6, points=$7, user_id=$8,
           updated_at=NOW(), server_version=server_version+1
       WHERE id=$9 RETURNING *`,
      [updated.title, updated.description, updated.status, updated.priority, updated.assignee, updated.tags, updated.points, updated.user_id, id]
    );

    res.json(formatTask(result.rows[0]));
  } catch (err) {
    console.error('PATCH /api/tasks/:id error:', err);
    res.status(500).json({ error: 'Failed to update task', detail: err.message });
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
    res.status(500).json({ error: 'Failed to delete task', detail: err.message });
  }
});

module.exports = router;
