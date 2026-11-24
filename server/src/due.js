function localISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextDue(day, today = new Date()) {
  const dueDay = Number(day);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) return null;

  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  function make(year, month) {
    const last = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay, last));
  }

  let due = make(start.getFullYear(), start.getMonth());
  if (due < start) due = make(start.getFullYear(), start.getMonth() + 1);

  const days = Math.round((due.getTime() - start.getTime()) / 86400000);
  return { date: localISO(due), days };
}

export function prettyDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}
