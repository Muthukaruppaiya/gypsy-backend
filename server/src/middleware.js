import jwt from 'jsonwebtoken';
import { query } from './db.js';

export const ROLES = ['admin', 'sales'];

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'gypsy-desk-dev-jwt',
    { expiresIn: '30d' },
  );
}

// The role is read from the database on every request, so a role change or a
// removed account takes effect at once instead of waiting for the token to expire.
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET || 'gypsy-desk-dev-jwt');
  } catch {
    return res.status(401).json({ error: 'Session expired. Sign in again.' });
  }
  try {
    const { rows } = await query('SELECT id, name, email, role FROM users WHERE id = $1', [payload.id]);
    if (!rows[0]) return res.status(401).json({ error: 'This account no longer exists.' });
    req.user = { ...rows[0], id: Number(rows[0].id) };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function isAdmin(req) {
  return req.user?.role === 'admin';
}

export function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Only an admin can open this.' });
  return next();
}
