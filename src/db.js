import pg from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('pg pool error:', err.message));

export class DbError extends Error {}

export async function query(text, params) {
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('DB error:', err.message);
    throw new DbError(err.message);
  }
}
