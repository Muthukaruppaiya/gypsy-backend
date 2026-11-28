import { query } from './db.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    client_name TEXT NOT NULL,
    lead_by TEXT,
    server_name TEXT,
    server_os TEXT,
    status TEXT NOT NULL DEFAULT 'Under Discussion'
      CHECK (status IN ('Live', 'Under Development', 'Under Discussion')),
    payment NUMERIC(12, 2) CHECK (payment IS NULL OR payment >= 0),
    balance NUMERIC(12, 2) CHECK (balance IS NULL OR balance >= 0),
    ip TEXT,
    server_username TEXT,
    server_password TEXT,
    server_due_day SMALLINT CHECK (server_due_day IS NULL OR server_due_day BETWEEN 1 AND 31),
    url TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status)`,
  `CREATE INDEX IF NOT EXISTS projects_client_idx ON projects (client_name)`,
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_server_cost NUMERIC(12, 2)`,
  `CREATE TABLE IF NOT EXISTS server_collections (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    year SMALLINT NOT NULL,
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    collected_on DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (project_id, year, month)
  )`,
  `CREATE INDEX IF NOT EXISTS server_collections_period_idx ON server_collections (year, month)`,
  `CREATE TABLE IF NOT EXISTS software_payments (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    paid_on DATE,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS software_payments_project_idx ON software_payments (project_id)`,
  `ALTER TABLE software_payments ADD COLUMN IF NOT EXISTS txn_no TEXT`,
  `ALTER TABLE server_collections ADD COLUMN IF NOT EXISTS txn_no TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS software_payments_txn_idx ON software_payments (txn_no)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS server_collections_txn_idx ON server_collections (txn_no)`,
  `CREATE TABLE IF NOT EXISTS txn_seq (
    id INTEGER PRIMARY KEY,
    n INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    client_name TEXT NOT NULL,
    phone TEXT,
    note TEXT,
    follow_up_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'Open'
      CHECK (status IN ('Open', 'Converted', 'Closed')),
    called_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS leads_follow_idx ON leads (status, follow_up_at)`,
  `CREATE INDEX IF NOT EXISTS leads_called_by_idx ON leads (called_by)`,
  // Roles: existing callers become sales; the first account is made admin if no admin exists.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'sales'`,
  `UPDATE users SET role = 'admin'
   WHERE id = (SELECT MIN(id) FROM users)
     AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')`,
];

export async function migrate() {
  for (const statement of statements) {
    await query(statement);
  }
  const { assignMissingTxnNumbers } = await import('./txn.js');
  await assignMissingTxnNumbers();
}
