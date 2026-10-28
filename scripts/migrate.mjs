import pg from 'pg';
import { readFileSync } from 'node:fs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(817421)');
  await client.query(readFileSync('db/schema.sql', 'utf8'));
  await client.query('COMMIT');
  console.log('Database schema ready');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
