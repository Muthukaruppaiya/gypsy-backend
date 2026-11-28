import { asyncRouter, isRealDate } from '../router.js';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware.js';
import { hasHostedServer, toProject } from '../domain.js';
import { nextTxnNo } from '../txn.js';

const router = asyncRouter();
router.use(requireAuth);
router.use(requireAdmin);

function dateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function toEntry(row) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    year: Number(row.year),
    month: Number(row.month),
    amount: Number(row.amount),
    collectedOn: dateOnly(row.collected_on),
    note: row.note,
    txnNo: row.txn_no,
  };
}

function readEntry(body) {
  const projectId = Number(body.projectId);
  const year = Number(body.year);
  const month = Number(body.month);
  const amount = Number(body.amount);
  if (!Number.isInteger(projectId)) return { error: 'Choose a project.' };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { error: 'Choose a year.' };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { error: 'Choose a month.' };
  if (!Number.isFinite(amount) || amount < 0) return { error: 'Amount must be zero or more.' };

  let collectedOn = null;
  if (body.collectedOn) {
    if (!isRealDate(body.collectedOn)) {
      return { error: 'Collected date must be a real date.' };
    }
    collectedOn = String(body.collectedOn);
  }

  const note = String(body.note || '').trim();
  if (note.length > 300) return { error: 'Note must be 300 characters or fewer.' };

  return {
    value: {
      projectId,
      year,
      month,
      amount: Math.round(amount * 100) / 100,
      collectedOn,
      note: note || null,
    },
  };
}

router.get('/timeline', async (req, res) => {
  const { rows } = await query(`
    SELECT * FROM projects
    ORDER BY client_name
  `);
  const hosted = rows.map((row) => toProject(row)).filter(hasHostedServer);
  const scheduled = hosted
    .filter((project) => project.serverDueDay)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const unscheduled = hosted.filter((project) => !project.serverDueDay);
  res.json({
    today: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
    scheduled,
    unscheduled,
  });
});

router.get('/collections', async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return res.status(400).json({ error: 'Choose a year.' });
  }
  const projects = await query(`
    SELECT * FROM projects
    ORDER BY CASE status
      WHEN 'Live' THEN 1
      WHEN 'Under Development' THEN 2
      ELSE 3
    END, client_name
  `);
  const hosted = projects.rows.map((row) => toProject(row)).filter(hasHostedServer);
  const hostedIds = new Set(hosted.map((project) => project.id));
  const entries = await query(
    'SELECT * FROM server_collections WHERE year = $1 ORDER BY month, project_id',
    [year],
  );
  res.json({
    year,
    projects: hosted,
    entries: entries.rows.map(toEntry).filter((entry) => hostedIds.has(entry.projectId)),
  });
});

router.put('/collections', async (req, res) => {
  const parsed = readEntry(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const entry = parsed.value;
  const project = await query('SELECT * FROM projects WHERE id = $1', [entry.projectId]);
  if (!project.rows[0]) return res.status(404).json({ error: 'Project not found.' });
  if (!hasHostedServer(toProject(project.rows[0]))) {
    return res.status(400).json({ error: 'Add the server details on the project before logging a hosting fee.' });
  }

  const existing = await query(
    `SELECT txn_no FROM server_collections
     WHERE project_id = $1 AND year = $2 AND month = $3`,
    [entry.projectId, entry.year, entry.month],
  );
  const txnNo = existing.rows[0]?.txn_no || await nextTxnNo();
  const { rows } = await query(
    `INSERT INTO server_collections (project_id, year, month, amount, collected_on, note, txn_no)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (project_id, year, month)
     DO UPDATE SET
       amount = EXCLUDED.amount,
       collected_on = EXCLUDED.collected_on,
       note = EXCLUDED.note,
       txn_no = COALESCE(server_collections.txn_no, EXCLUDED.txn_no),
       updated_at = NOW()
     RETURNING *`,
    [entry.projectId, entry.year, entry.month, entry.amount, entry.collectedOn, entry.note, txnNo],
  );
  res.json(toEntry(rows[0]));
});

router.delete('/collections/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid entry.' });
  const { rowCount } = await query('DELETE FROM server_collections WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Entry not found.' });
  res.status(204).end();
});

export default router;
