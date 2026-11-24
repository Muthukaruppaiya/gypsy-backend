import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { requireAuth, signToken } from '../middleware.js';

const router = Router();

function cleanEmail(value) {
  return String(value || '').trim().toLowerCase();
}

router.post('/register', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash],
    );
    const user = rows[0];
    return res.status(201).json({ token: signToken(user), user });
  } catch (error) {
    if (error.code === '23505' || /unique/i.test(error.message || '')) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', async (req, res) => {
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  const { rows } = await query(
    'SELECT id, name, email, password_hash FROM users WHERE email = $1',
    [email],
  );
  const user = rows[0];
  const matches = user && await bcrypt.compare(password, user.password_hash);
  if (!matches) return res.status(401).json({ error: 'Email or password is incorrect.' });
  return res.json({
    token: signToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: 'Sign in required.' });
  return res.json(rows[0]);
});

router.patch('/me', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  const { rows } = await query(
    'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email',
    [name, req.user.id],
  );
  return res.json(rows[0]);
});

router.post('/users', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = cleanEmail(req.body.email);
  const password = String(req.body.password || '');
  if (name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, passwordHash],
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === '23505' || /unique/i.test(error.message || '')) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Could not add the caller.' });
  }
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

export default router;
