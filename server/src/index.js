import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { closeDb, databaseLabel, initDb } from './db.js';
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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, database: databaseLabel() });
});

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/leads', leadRoutes);

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Something went wrong.' });
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

main();
