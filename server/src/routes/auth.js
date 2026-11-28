import { asyncRouter } from '../router.js';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { ROLES, requireAdmin, requireAuth, signToken } from '../middleware.js';

const router = asyncRouter();

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function toUser(row) {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    role: row.role,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.open_leads != null ? { openLeads: Number(row.open_leads) } : {}),
  };
}

function readNewUser(body) {
  const name = String(body.name || '').trim();
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (name.length < 2) return { error: 'Name is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email.' };
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  return { value: { name, email, password } };
}

function readRole(value, fallback) {
  const role = value == null || value === '' ? fallback : String(value);
  return ROLES.includes(role) ? role : null;
}

async function adminCount() {
  const { rows } = await query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'admin'");
  return Number(rows[0].count);
}

function duplicate(error) {
  return error.code === '23505' || /unique/i.test(error.message || '');
}

// Open sign-up is only for setting up an empty desk. After that, admins add people from Team.
router.post('/register', async (req, res) => {
  const existing = await query('SELECT COUNT(*)::int AS count FROM users');
  if (Number(existing.rows[0].count) > 0) {
    return res.status(403).json({ error: 'Sign-up is closed. Ask an admin to add you from the Team page.' });
  }
  const parsed = readNewUser(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const passwordHash = await bcrypt.hash(parsed.value.password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
       RETURNING id, name, email, role`,
      [parsed.value.name, parsed.value.email, passwordHash],
    );
    const user = toUser(rows[0]);
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (duplicate(error)) return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error(error);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const { rows } = await query(
    'SELECT id, name, email, role, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const matches = user && await bcrypt.compare(password, user.password_hash);
  if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
  return res.json({ token: signToken(user), user: toUser(user) });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json(toUser(req.user));
});

router.patch('/me', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  const { rows } = await query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role',
    [name, req.user.id],
  );
  return res.json(toUser(rows[0]));
});

router.post('/password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body.currentPassword || '');
  const newPassword = String(req.body.newPassword || '');
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters.' });
  }
  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const matches = rows[0] && await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!matches) return res.status(400).json({ error: 'Current password is incorrect.' });
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
  return res.json({ ok: true });
});

/* ---------- Team management (admin only) ---------- */

router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  const { rows } = await query(`
    SELECT u.id, u.name, u.email, u.role, u.created_at,
           COUNT(l.id) FILTER (WHERE l.status = 'Open') AS open_leads
    FROM users u
    LEFT JOIN leads l ON l.called_by = u.id
    GROUP BY u.id
    ORDER BY CASE u.role WHEN 'admin' THEN 0 ELSE 1 END, u.name, u.id
  `);
  res.json(rows.map(toUser));
});

router.post('/users', requireAuth, requireAdmin, async (req, res) => {
  const parsed = readNewUser(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  const role = readRole(req.body.role, 'sales');
  if (!role) return res.status(400).json({ error: 'Role must be admin or sales.' });
  try {
    const passwordHash = await bcrypt.hash(parsed.value.password, 10);
    const { rows } = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [parsed.value.name, parsed.value.email, passwordHash, role],
    );
    return res.status(201).json(toUser(rows[0]));
  } catch (error) {
    if (duplicate(error)) return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error(error);
    return res.status(500).json({ error: 'Could not add the person.' });
  }
});

router.patch('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user.' });
  const found = await query('SELECT id, name, role FROM users WHERE id = $1', [id]);
  if (!found.rows[0]) return res.status(404).json({ error: 'User not found.' });
  const role = readRole(req.body.role, found.rows[0].role);
  if (!role) return res.status(400).json({ error: 'Role must be admin or sales.' });
  const name = req.body.name == null ? found.rows[0].name : String(req.body.name).trim();
  if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  if (found.rows[0].role === 'admin' && role !== 'admin' && await adminCount() <= 1) {
    return res.status(400).json({ error: 'Keep at least one admin on the desk.' });
  }
  const { rows } = await query(
    'UPDATE users SET name = $1, role = $2 WHERE id = $3 RETURNING id, name, email, role, created_at',
    [name, role, id],
  );
  return res.json(toUser(rows[0]));
});

router.post('/users/:id/password', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user.' });
  const password = String(req.body.password || '');
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const passwordHash = await bcrypt.hash(password, 10);
  const { rowCount } = await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
  if (!rowCount) return res.status(404).json({ error: 'User not found.' });
  return res.json({ ok: true });
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid user.' });
  if (id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own login.' });
  const found = await query('SELECT role FROM users WHERE id = $1', [id]);
  if (!found.rows[0]) return res.status(404).json({ error: 'User not found.' });
  if (found.rows[0].role === 'admin' && await adminCount() <= 1) {
    return res.status(400).json({ error: 'Keep at least one admin on the desk.' });
  }
  // Their leads stay; called_by becomes empty (ON DELETE SET NULL).
  await query('DELETE FROM users WHERE id = $1', [id]);
  return res.status(204).end();
});

export default router;
