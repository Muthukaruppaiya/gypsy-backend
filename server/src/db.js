import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool;
let lite;
let mode = 'postgres';

export function databaseLabel() {
  return mode === 'pglite' ? 'PostgreSQL (embedded)' : 'PostgreSQL';
}

export async function initDb() {
  if (process.env.DATABASE_URL) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query('SELECT 1');
    mode = 'postgres';
    return;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const dataDir = path.join(__dirname, '..', 'data', 'pglite');
  fs.mkdirSync(dataDir, { recursive: true });
  lite = new PGlite(dataDir);
  if (lite.waitReady) await lite.waitReady;
  mode = 'pglite';
}

export async function query(text, params = []) {
  if (pool) {
    const result = await pool.query(text, params);
    return { rows: result.rows, rowCount: result.rowCount };
  }
  const result = await lite.query(text, params);
  return {
    rows: result.rows,
    rowCount: result.affectedRows ?? result.rows?.length ?? 0,
  };
}

export async function closeDb() {
  if (pool) await pool.end();
  if (lite) await lite.close();
}
