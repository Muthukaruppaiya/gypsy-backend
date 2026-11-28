import bcrypt from 'bcryptjs';
import { query } from './db.js';

export async function seed() {
  const users = await query('SELECT COUNT(*)::int AS count FROM users');
  if (Number(users.rows[0].count) === 0) {
    const passwordHash = await bcrypt.hash('Desk@2026', 10);
    await query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
      ['Muthu', 'muthu@gypsycoder.local', passwordHash],
    );
  }
}
