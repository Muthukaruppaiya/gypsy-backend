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
  takeLock(path.join(__dirname, '..', 'data', 'desk.lock'));
  lite = new PGlite(dataDir);
  if (lite.waitReady) await lite.waitReady;
  mode = 'pglite';
}

// The embedded database must only be opened by one process. Two servers writing the
// same folder corrupt it, so a second server refuses to start while the first is alive.
let lockPath = null;

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function takeLock(file) {
  if (fs.existsSync(file)) {
    const pid = Number(fs.readFileSync(file, 'utf8').trim());
    if (pid && pid !== process.pid && alive(pid)) {
      throw new Error(
        `Another Gypsy Desk server (process ${pid}) already has the database open. `
        + 'Stop it first, or use that one. Two servers on one embedded database can damage the data. '
        + 'If no server is running, delete server/data/desk.lock and start again.',
      );
    }
  }
  fs.writeFileSync(file, String(process.pid));
  lockPath = file;
  const release = () => {
    try {
      if (lockPath && fs.readFileSync(lockPath, 'utf8').trim() === String(process.pid)) fs.unlinkSync(lockPath);
    } catch {}
  };
  process.on('exit', release);
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
