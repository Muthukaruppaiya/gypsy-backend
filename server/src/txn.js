import { query } from './db.js';

export function formatTxn(n) {
  return `GC-${String(n).padStart(4, '0')}`;
}

export async function nextTxnNo() {
  const { rows } = await query(`
    INSERT INTO txn_seq (id, n) VALUES (1, 1)
    ON CONFLICT (id) DO UPDATE SET n = txn_seq.n + 1
    RETURNING n
  `);
  return formatTxn(Number(rows[0].n));
}

export async function assignMissingTxnNumbers() {
  const payments = await query(
    'SELECT id, created_at FROM software_payments WHERE txn_no IS NULL ORDER BY created_at, id',
  );
  const servers = await query(
    'SELECT id, created_at FROM server_collections WHERE txn_no IS NULL ORDER BY created_at, id',
  );
  const rows = [
    ...payments.rows.map((row) => ({ table: 'software_payments', id: row.id, at: new Date(row.created_at).getTime() || 0 })),
    ...servers.rows.map((row) => ({ table: 'server_collections', id: row.id, at: new Date(row.created_at).getTime() || 0 })),
  ].sort((a, b) => a.at - b.at || a.id - b.id);

  for (const row of rows) {
    const txnNo = await nextTxnNo();
    await query(
      `UPDATE ${row.table} SET txn_no = $1 WHERE id = $2 AND txn_no IS NULL`,
      [txnNo, row.id],
    );
  }
}
