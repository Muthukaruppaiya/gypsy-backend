import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { closeDb, databaseLabel, initDb, query } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import serverRoutes from './routes/servers.js';
import paymentRoutes from './routes/payments.js';
import leadRoutes from './routes/leads.js';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors({
  origin(origin, callback) {
    if (!origin || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) callback(null, true);
    else callback(null, false);
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS count FROM users');
    res.json({ ok: true, database: databaseLabel(), needsSetup: Number(rows[0].count) === 0 });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/leads', leadRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Turn bad input into a clear 400 instead of a crash or a vague 500.
app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'The request could not be read. Refresh and try again.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That is too much text to save at once.' });
  }
  // PostgreSQL: numeric out of range, invalid text, bad date, value too long.
  if (['22003', '22P02', '22008', '22007', '22001'].includes(error.code)) {
    return res.status(400).json({ error: 'One of the values is not valid. Check the numbers and dates.' });
  }
  if (error.code === '23503') {
    return res.status(400).json({ error: 'That record is linked to something that no longer exists.' });
  }
  console.error(error);
  return res.status(500).json({ error: 'Something went wrong. Try again.' });
});

async function main() {
  try {
    await initDb();
  } catch (error) {
    console.error('Could not open PostgreSQL.');
    console.error(error.message);
    if (process.env.DATABASE_URL) {
      console.error('Check DATABASE_URL, or comment it out to use the embedded PostgreSQL database.');
    }
    process.exit(1);
  }

  await migrate();
  await seed();

  const server = app.listen(port, () => {
    console.log(`Gypsy Desk API   http://localhost:${port}`);
    console.log(`Database         ${databaseLabel()}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Port ${port} is already in use.`);
    else console.error(error);
    process.exit(1);
  });
}

async function shutdown() {
  await closeDb();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGBREAK', shutdown);
process.on('SIGHUP', shutdown);
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
});

main();
