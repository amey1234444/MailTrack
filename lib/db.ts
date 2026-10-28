import { Pool, type QueryResultRow } from 'pg';
const globalDb = globalThis as unknown as { mailtrackPool?: Pool };
export async function query<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured');
  const pool = (globalDb.mailtrackPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  }));
  return (await pool.query<T>(sql, params)).rows;
}
