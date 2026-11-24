import { Router } from 'express';
import { query } from '../db.js';
import { encrypt } from '../crypto.js';
import { requireAuth } from '../middleware.js';
import { buildOverview, hasHostedServer, toProject } from '../domain.js';
import { validateProject } from '../validate.js';

const router = Router();

router.use(requireAuth);

function csvCell(value) {
  if (value == null) return '';
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const PROJECT_FROM = `
  FROM projects p
  LEFT JOIN (
    SELECT project_id, SUM(amount) AS collected
    FROM software_payments
    GROUP BY project_id
  ) pay ON pay.project_id = p.id
`;

async function loadAll(filters = {}) {
  const params = [];
  const where = [];
  if (filters.status) {
    params.push(filters.status);
    where.push(`p.status = $${params.length}`);
  }
  if (filters.lead) {
    params.push(filters.lead);
    where.push(`p.lead_by = $${params.length}`);
  }
  if (filters.q) {
    params.push(`%${filters.q}%`);
    where.push(`(
      p.client_name ILIKE $${params.length}
      OR COALESCE(p.lead_by, '') ILIKE $${params.length}
      OR COALESCE(p.server_name, '') ILIKE $${params.length}
      OR COALESCE(p.url, '') ILIKE $${params.length}
      OR COALESCE(p.ip, '') ILIKE $${params.length}
    )`);
  }
  const sql = `
    SELECT p.*, COALESCE(pay.collected, 0) AS collected
    ${PROJECT_FROM}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CASE p.status
      WHEN 'Live' THEN 1
      WHEN 'Under Development' THEN 2
      ELSE 3
    END, p.client_name
  `;
  const { rows } = await query(sql, params);
  return rows;
}

async function findProject(id) {
  const { rows } = await query(
    `SELECT p.*, COALESCE(pay.collected, 0) AS collected ${PROJECT_FROM} WHERE p.id = $1`,
    [id],
  );
  return rows[0] || null;
}

router.get('/overview', async (req, res) => {
  const rows = await loadAll();
  const projects = rows.map((row) => toProject(row));
  const overview = buildOverview(projects);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const collected = await query(
    'SELECT project_id, amount FROM server_collections WHERE year = $1 AND month = $2',
    [year, month],
  );
  const got = new Map(collected.rows.map((row) => [Number(row.project_id), Number(row.amount)]));
  let expected = 0;
  let taken = 0;
  let openCount = 0;
  for (const project of projects) {
    if (!hasHostedServer(project)) continue;
    const rate = project.monthlyServerCost || 0;
    if (!rate) continue;
    expected += rate;
    if (got.has(project.id)) taken += got.get(project.id);
    else openCount += 1;
  }
  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long' });
  overview.serverMonth = { year, month, label: monthLabel, expected, collected: taken, openCount };
  res.json(overview);
});

router.get('/export.csv', async (req, res) => {
  const rows = await loadAll();
  const header = [
    'S.no', 'Client', 'Lead By', 'Server name', 'Server OS', 'Project status',
    'Payment(for software)', 'Balance', 'IP', 'username', 'Password', 'Server due date', 'Url', 'Notes',
  ];
  const lines = [header.join(',')];
  rows.forEach((row, index) => {
    const project = toProject(row, true);
    lines.push([
      index + 1,
      project.clientName,
      project.leadBy,
      project.serverName,
      project.serverOs,
      project.status,
      project.payment,
      project.balance,
      project.ip,
      project.serverUsername,
      project.serverPassword,
      project.serverDueDay,
      project.url,
      project.notes,
    ].map(csvCell).join(','));
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="project-details.csv"');
  res.send(`\uFEFF${lines.join('\n')}`);
});

router.get('/', async (req, res) => {
  const rows = await loadAll({
    status: req.query.status,
    lead: req.query.lead,
    q: req.query.q,
  });
  res.json(rows.map((row) => toProject(row)));
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project.' });
  const row = await findProject(id);
  if (!row) return res.status(404).json({ error: 'Project not found.' });
  res.json(toProject(row));
});

router.post('/:id/reveal', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project.' });
  const { rows } = await query('SELECT * FROM projects WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Project not found.' });
  const project = toProject(rows[0], true);
  res.json({ serverPassword: project.serverPassword });
});

router.post('/', async (req, res) => {
  const parsed = validateProject(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const project = parsed.value;
  const { rows } = await query(
    `INSERT INTO projects (
      client_name, lead_by, server_name, server_os, status, payment, balance,
      ip, server_username, server_password, server_due_day, url, notes,
      monthly_server_cost, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    ) RETURNING *`,
    [
      project.clientName,
      project.leadBy,
      project.serverName,
      project.serverOs,
      project.status,
      project.payment,
      project.balance,
      project.ip,
      project.serverUsername,
      encrypt(project.serverPassword),
      project.serverDueDay,
      project.url,
      project.notes,
      project.monthlyServerCost,
      req.user.id,
    ],
  );
  res.status(201).json(toProject(await findProject(rows[0].id)));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project.' });
  const parsed = validateProject(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const existing = await query('SELECT * FROM projects WHERE id = $1', [id]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'Project not found.' });

  const project = parsed.value;
  let passwordValue = existing.rows[0].server_password;
  if (project.clearPassword) passwordValue = null;
  else if (project.serverPassword) passwordValue = encrypt(project.serverPassword);

  const { rows } = await query(
    `UPDATE projects SET
      client_name = $1,
      lead_by = $2,
      server_name = $3,
      server_os = $4,
      status = $5,
      payment = $6,
      balance = $7,
      ip = $8,
      server_username = $9,
      server_password = $10,
      server_due_day = $11,
      url = $12,
      notes = $13,
      monthly_server_cost = $14,
      updated_at = NOW()
    WHERE id = $15
    RETURNING *`,
    [
      project.clientName,
      project.leadBy,
      project.serverName,
      project.serverOs,
      project.status,
      project.payment,
      project.balance,
      project.ip,
      project.serverUsername,
      passwordValue,
      project.serverDueDay,
      project.url,
      project.notes,
      project.monthlyServerCost,
      id,
    ],
  );
  res.json(toProject(await findProject(id)));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid project.' });
  const { rowCount } = await query('DELETE FROM projects WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Project not found.' });
  res.status(204).end();
});

export default router;
