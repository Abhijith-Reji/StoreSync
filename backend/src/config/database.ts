import { Pool, PoolClient } from 'pg';
import { config } from './env';

export const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
  max: 20, // max connection pool for concurrent POS counters
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected error on idle client:', err);
});

export async function testDbConnection(): Promise<boolean> {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT NOW() AS current_time, current_database() AS db_name');
    console.log(`[PostgreSQL] Connected to "${res.rows[0].db_name}" at ${res.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('[PostgreSQL] Database connection failed:', error);
    return false;
  } finally {
    if (client) client.release();
  }
}

/**
 * Execute work inside an ACID transaction with automatic COMMIT and ROLLBACK.
 * Supports row-level locking (SELECT ... FOR UPDATE) inside the callback.
 */
export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
