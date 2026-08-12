require('dotenv').config();
const { Pool } = require('pg');

// Strip any sslmode param from the URL so pg-connection-string does not
// set rejectUnauthorized:true internally, then enforce our own ssl config.
const connectionString = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err.message);
});

module.exports = pool;
