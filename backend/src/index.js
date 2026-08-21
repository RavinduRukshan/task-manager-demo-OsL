require('dotenv').config();
const express = require('express');
const cors = require('cors');
const tasksRouter = require('./routes/tasks');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  exposedHeaders: ['x-schema-version', 'Date', 'x-user-id'],
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path} → ${res.statusCode} (${Date.now() - start}ms)`
    );
  });
  next();
});

// Routes
app.use('/api/tasks', tasksRouter);

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    console.error('Health check database error:', err);
    res.status(503).json({ status: 'degraded', database: 'disconnected' });
  }
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  console.log(`Backend running on http://localhost:${PORT}`);

  try {
    await db.query('SELECT 1');
    console.log('Database connected successfully');
    if (db.autoMigrate) {
      await db.autoMigrate();
    }
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }
});
