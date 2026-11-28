import { asyncRouter, isRealDate } from '../router.js';
import { query } from '../db.js';
import { requireAdmin, requireAuth } from '../middleware.js';
import { toProject } from '../domain.js';
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

function toPayment(row) {
  return {
    id: Number(row.id),
    projectId: Number(row.project_id),
    clientName: row.client_name,
    amount: Number(row.amount),
    paidOn: dateOnly(row.paid_on),
    note: row.note,
    txnNo: row.txn_no,
    createdAt: row.created_at,
  };
}

function readPayment(body) {
  const projectId = Number(body.projectId);
  const amount = Number(body.amount);
  if (!Number.isInteger(projectId)) return { error: 'Choose a project.' };
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Amount must be more than zero.' };
  if (!isRealDate(body.paidOn)) {
    return { error: 'Choose the date the payment was received.' };
  }
  const note = String(body.note || '').trim();
  if (note.length > 300) return { error: 'Note must be 300 characters or fewer.' };
  return {
    value: {
      projectId,
      amount: Math.round(amount * 100) / 100,
      paidOn: String(body.paidOn),
      note: note || null,
    },
  };
}

router.get('/receipts', async (req, res) => {
  const { rows } = await query(`
    SELECT sp.txn_no, sp.amount, sp.paid_on AS happened_on, sp.note, sp.created_at,
           'Software' AS kind, p.client_name, sp.project_id
    FROM software_payments sp
    JOIN projects p ON p.id = sp.project_id
    UNION ALL
    SELECT sc.txn_no, sc.amount, sc.collected_on, sc.note, sc.created_at,
           'Server' AS kind, p.client_name, sc.project_id
    FROM server_collections sc
    JOIN projects p ON p.id = sc.project_id
    ORDER BY created_at DESC, txn_no DESC
  `);
  res.json(rows.map((row) => ({
    txnNo: row.txn_no,
    amount: Number(row.amount),
    happenedOn: dateOnly(row.happened_on),
    note: row.note,
    kind: row.kind,
    clientName: row.client_name,
    projectId: Number(row.project_id),
  })));
});

router.get('/', async (req, res) => {
  const payments = await query(`
    SELECT sp.*, p.client_name
    FROM software_payments sp
    JOIN projects p ON p.id = sp.project_id
    ORDER BY sp.paid_on DESC NULLS LAST, sp.id DESC
  `);
  const projects = await query(`
    SELECT p.*, COALESCE(pay.collected, 0) AS collected
    FROM projects p
    LEFT JOIN (
      SELECT project_id, SUM(amount) AS collected
      FROM software_payments
      GROUP BY project_id
    ) pay ON pay.project_id = p.id
    ORDER BY p.client_name
  `);
  res.json({
    payments: payments.rows.map(toPayment),
    projects: projects.rows.map((row) => toProject(row)),
  });
});

router.post('/', async (req, res) => {
  const parsed = readPayment(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payment = parsed.value;
  const project = await query('SELECT id FROM projects WHERE id = $1', [payment.projectId]);
  if (!project.rows[0]) return res.status(404).json({ error: 'Project not found.' });
  const txnNo = await nextTxnNo();
  const { rows } = await query(
    `INSERT INTO software_payments (project_id, amount, paid_on, note, txn_no)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [payment.projectId, payment.amount, payment.paidOn, payment.note, txnNo],
  );
  const saved = await query(
    `SELECT sp.*, p.client_name
     FROM software_payments sp
     JOIN projects p ON p.id = sp.project_id
     WHERE sp.id = $1`,
    [rows[0].id],
  );
  res.status(201).json(toPayment(saved.rows[0]));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid payment.' });
  const parsed = readPayment(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const payment = parsed.value;
  const project = await query('SELECT id FROM projects WHERE id = $1', [payment.projectId]);
  if (!project.rows[0]) return res.status(404).json({ error: 'Project not found.' });
  const { rows } = await query(
    `UPDATE software_payments
     SET project_id = $1, amount = $2, paid_on = $3, note = $4
     WHERE id = $5
     RETURNING id`,
    [payment.projectId, payment.amount, payment.paidOn, payment.note, id],
  );
  if (!rows[0]) return res.status(404).json({ error: 'Payment not found.' });
  const saved = await query(
    `SELECT sp.*, p.client_name
     FROM software_payments sp
     JOIN projects p ON p.id = sp.project_id
     WHERE sp.id = $1`,
    [id],
  );
  res.json(toPayment(saved.rows[0]));
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid payment.' });
  const { rowCount } = await query('DELETE FROM software_payments WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Payment not found.' });
  res.status(204).end();
});

export default router;
