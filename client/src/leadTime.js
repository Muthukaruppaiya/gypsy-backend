// Shared date helpers for the lead pages.

export function pad(value) {
  return String(value).padStart(2, '0');
}

export function toLocalInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export function chipTimes(now = new Date()) {
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening <= now) evening.setDate(evening.getDate() + 1);
  const morning = new Date(now);
  morning.setDate(morning.getDate() + 1);
  morning.setHours(10, 0, 0, 0);
  const later = new Date(now);
  later.setDate(later.getDate() + 2);
  later.setHours(11, 0, 0, 0);
  const week = new Date(now);
  week.setDate(week.getDate() + 7);
  week.setHours(11, 0, 0, 0);
  return [
    { id: 'hour', label: 'In an hour', value: toLocalInput(new Date(now.getTime() + 60 * 60 * 1000)) },
    { id: 'evening', label: evening.getDate() === now.getDate() ? 'This evening' : 'Tomorrow evening', value: toLocalInput(evening) },
    { id: 'morning', label: 'Tomorrow morning', value: toLocalInput(morning) },
    { id: 'later', label: 'In 2 days', value: toLocalInput(later) },
    { id: 'week', label: 'Next week', value: toLocalInput(week) },
  ];
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// "Today", "Tomorrow", or a weekday/date label for grouping the Later list.
export function dayLabel(iso, now = new Date()) {
  const date = new Date(iso);
  const diff = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return date.toLocaleDateString('en-IN', { weekday: 'long' });
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}
