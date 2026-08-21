-- Run this script against your PostgreSQL database to set up the schema
-- psql -U postgres -d taskmanager -f schema.sql

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

CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks (updated_at);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
