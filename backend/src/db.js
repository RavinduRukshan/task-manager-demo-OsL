require('dotenv').config();
const { Pool } = require('pg');

// Strip any sslmode param from the URL so pg-connection-string does not
// set rejectUnauthorized:true internally, then enforce our own ssl config.
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');

const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : {
    rejectUnauthorized: false,
  },
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

async function autoMigrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id              VARCHAR(36)   PRIMARY KEY,
        title           VARCHAR(255)  NOT NULL,
        description     TEXT,
        status          VARCHAR(50)   NOT NULL DEFAULT 'open',
        priority        VARCHAR(50)   NOT NULL DEFAULT 'medium',
        assignee        VARCHAR(100),
        tags            TEXT[]        DEFAULT '{}',
        points          INTEGER       DEFAULT 0,
        user_id         VARCHAR(100)  DEFAULT 'default',
        updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        server_version  INTEGER       NOT NULL DEFAULT 1
      );
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id VARCHAR(100) DEFAULT 'default';
      CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks (updated_at);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
    `);
    console.log('Database schema verified & auto-migrated successfully.');
  } catch (err) {
    console.error('Auto-migration warning (database may be offline or initializing):', err.message);
  }
}

pool.autoMigrate = autoMigrate;

module.exports = pool;
