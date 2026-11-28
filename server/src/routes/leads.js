import { asyncRouter } from '../router.js';
import { query } from '../db.js';
import { requireAuth } from '../middleware.js';
import { forRole, toProject } from '../domain.js';

const router = asyncRouter();
router.use(requireAuth);

const LEAD_FROM = `
  FROM leads l
  LEFT JOIN users u ON u.id = l.called_by
  LEFT JOIN projects p ON p.id = l.project_id
`;

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toLead(row) {
  return {
    id: Number(row.id),
    clientName: row.client_name,
    phone: row.phone,
    note: row.note,
    followUpAt: iso(row.follow_up_at),
    status: row.status,
    calledBy: row.called_by == null ? null : Number(row.called_by),
    callerName: row.caller_name,
    projectId: row.project_id == null ? null : Number(row.project_id),
    createdAt: iso(row.created_at),
  };
}

function readLead(body, { requireWhen = true } = {}) {
  const clientName = String(body.clientName || '').trim();
  if (clientName.length < 2) return { error: 'Client name is required.' };
  if (clientName.length > 200) return { error: 'Client name must be 200 characters or fewer.' };

  const phone = String(body.phone || '').trim();
  if (phone.length > 30) return { error: 'Phone must be 30 characters or fewer.' };

  const note = String(body.note || '').trim();
  if (!note) return { error: 'Write what the client said.' };
  if (note.length > 1000) return { error: 'Note must be 1000 characters or fewer.' };

  let followUpAt = null;
  if (body.followUpAt) {
    const when = new Date(body.followUpAt);
    if (Number.isNaN(when.getTime())) return { error: 'Choose a real date and time to call back.' };
    const years = (when.getTime() - Date.now()) / (365 * 24 * 60 * 60 * 1000);
    if (years > 2) return { error: 'Follow-up has to be within two years.' };
    followUpAt = when.toISOString();
  } else if (requireWhen) {
    return { error: 'Choose when to contact them again.' };
  }

  let calledBy = null;
  if (body.calledBy !== '' && body.calledBy != null) {
    calledBy = Number(body.calledBy);
    if (!Number.isInteger(calledBy)) return { error: 'Choose who made the call.' };
  }

  let status = 'Open';
  if (body.status) {
    status = String(body.status);
    if (status !== 'Open' && status !== 'Closed') {
      return { error: 'A lead can be open or closed here.' };
    }
  }

  return {
    value: {
      clientName,
      phone: phone || null,
      note,
      followUpAt,
      calledBy,
      status,
    },
  };
}

async function loadLead(id) {
  const { rows } = await query(`SELECT l.*, u.name AS caller_name ${LEAD_FROM} WHERE l.id = $1`, [id]);
  return rows[0] || null;
}

async function users() {
  const { rows } = await query('SELECT id, name, role FROM users ORDER BY name, id');
  return rows.map((row) => ({ id: Number(row.id), name: row.name, role: row.role }));
}

router.get('/reminders', async (req, res) => {
  const { rows } = await query(
    `SELECT l.*, u.name AS caller_name
     ${LEAD_FROM}
     WHERE l.status = 'Open'
       AND l.follow_up_at <= NOW()
       AND (l.called_by = $1 OR l.called_by IS NULL)
     ORDER BY l.follow_up_at, l.id`,
    [req.user.id],
  );
  res.json(rows.map(toLead));
});

router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT l.*, u.name AS caller_name ${LEAD_FROM} ORDER BY l.follow_up_at, l.id`,
  );
  res.json({ leads: rows.map(toLead), users: await users() });
});

router.post('/', async (req, res) => {
  const parsed = readLead(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const lead = parsed.value;
  const calledBy = lead.calledBy || req.user.id;
  const caller = await query('SELECT id FROM users WHERE id = $1', [calledBy]);
  if (!caller.rows[0]) return res.status(400).json({ error: 'Choose who made the call.' });

  const { rows } = await query(
    `INSERT INTO leads (client_name, phone, note, follow_up_at, called_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [lead.clientName, lead.phone, lead.note, lead.followUpAt, calledBy],
  );
  res.status(201).json(toLead(await loadLead(rows[0].id)));
});

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid lead.' });
  const existing = await loadLead(id);
  if (!existing) return res.status(404).json({ error: 'Lead not found.' });
  if (existing.status === 'Converted') {
    return res.status(400).json({ error: 'This lead is already a project.' });
  }

  const parsed = readLead({ ...req.body, status: req.body.status || existing.status });
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const lead = parsed.value;
  const calledBy = lead.calledBy || existing.called_by || req.user.id;
  const caller = await query('SELECT id FROM users WHERE id = $1', [calledBy]);
  if (!caller.rows[0]) return res.status(400).json({ error: 'Choose who made the call.' });

  await query(
    `UPDATE leads SET
      client_name = $1,
      phone = $2,
      note = $3,
      follow_up_at = $4,
      called_by = $5,
      status = $6,
      updated_at = NOW()
     WHERE id = $7`,
    [lead.clientName, lead.phone, lead.note, lead.followUpAt, calledBy, lead.status, id],
  );
  res.json(toLead(await loadLead(id)));
});

router.post('/:id/snooze', async (req, res) => {
  const id = Number(req.params.id);
  const minutes = Number(req.body.minutes);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid lead.' });
  if (!Number.isFinite(minutes) || minutes < 15 || minutes > 10080) {
    return res.status(400).json({ error: 'Choose a reminder between 15 minutes and 7 days.' });
  }
  const existing = await loadLead(id);
  if (!existing) return res.status(404).json({ error: 'Lead not found.' });
  if (existing.status !== 'Open') return res.status(400).json({ error: 'Only an open lead can be snoozed.' });

  const when = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  await query('UPDATE leads SET follow_up_at = $1, updated_at = NOW() WHERE id = $2', [when, id]);
  res.json(toLead(await loadLead(id)));
});

router.post('/:id/convert', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid lead.' });
  const existing = await loadLead(id);
  if (!existing) return res.status(404).json({ error: 'Lead not found.' });

  if (existing.status === 'Converted' && existing.project_id) {
    const project = await query('SELECT * FROM projects WHERE id = $1', [existing.project_id]);
    if (project.rows[0]) {
      return res.json({ lead: toLead(existing), project: forRole(toProject(project.rows[0]), req.user.role) });
    }
  }
  if (existing.status === 'Closed') {
    return res.status(400).json({ error: 'Reopen the lead before turning it into a project.' });
  }

  const when = iso(existing.follow_up_at);
  const pretty = when
    ? new Date(when).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const notes = [
    'Opened from a cold call.',
    existing.phone ? `Phone: ${existing.phone}` : null,
    existing.note ? `They said: ${existing.note}` : null,
    pretty ? `Follow-up was ${pretty}.` : null,
  ].filter(Boolean).join('\n');

  const inserted = await query(
    `INSERT INTO projects (
      client_name, lead_by, status, notes, created_by
    ) VALUES ($1, $2, 'Under Discussion', $3, $4)
    RETURNING id`,
    [existing.client_name, existing.caller_name || req.user.name || null, notes, req.user.id],
  );
  const projectId = inserted.rows[0].id;

  try {
    await query(
      `UPDATE leads SET status = 'Converted', project_id = $1, updated_at = NOW() WHERE id = $2`,
      [projectId, id],
    );
  } catch (error) {
    await query('DELETE FROM projects WHERE id = $1', [projectId]);
    throw error;
  }

  const project = await query('SELECT * FROM projects WHERE id = $1', [projectId]);
  res.status(201).json({ lead: toLead(await loadLead(id)), project: forRole(toProject(project.rows[0]), req.user.role) });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid lead.' });
  const { rowCount } = await query('DELETE FROM leads WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: 'Lead not found.' });
  res.status(204).end();
});

export default router;
