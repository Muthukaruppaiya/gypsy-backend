export const STATUSES = ['Live', 'Under Development', 'Under Discussion'];

export function inr(value) {
  if (value == null || value === '') return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function dueLabel(days, date) {
  if (days == null || !date) return '—';
  const [year, month, day] = date.split('-').map(Number);
  const when = new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
  if (days === 0) return `Due today · ${when}`;
  if (days === 1) return `Tomorrow · ${when}`;
  return `${when} · in ${days} days`;
}

export function dueTone(days) {
  if (days == null) return 'quiet';
  if (days <= 7) return 'urgent';
  if (days <= 14) return 'soon';
  return 'quiet';
}

export function urlLinks(value) {
  if (!value) return [];
  return value
    .split(/[,|\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((label) => ({
      label,
      href: /^https?:\/\//i.test(label) ? label : `https://${label}`,
    }));
}

export function followUpLabel(iso) {
  if (!iso) return 'No time set';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No time set';
  const diff = date.getTime() - Date.now();
  const absMin = Math.round(Math.abs(diff) / 60000);
  const clock = date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (absMin < 1) return `Now · ${clock}`;
  if (absMin < 60) return diff < 0 ? `${absMin} min overdue · ${clock}` : `In ${absMin} min · ${clock}`;
  const hours = Math.round(absMin / 60);
  if (hours < 36) return diff < 0 ? `${hours} hr overdue · ${clock}` : `In ${hours} hr · ${clock}`;
  const days = Math.round(hours / 24);
  return diff < 0 ? `${days} days overdue · ${clock}` : `In ${days} days · ${clock}`;
}

// Links for a phone number: tap to call, and WhatsApp (10-digit Indian numbers get +91).
export function phoneLinks(phone) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (digits.replace('+', '').length < 6) return null;
  let wa = digits.replace(/^\+/, '');
  if (/^0\d{10}$/.test(wa)) wa = wa.slice(1);
  if (/^\d{10}$/.test(wa)) wa = `91${wa}`;
  return { tel: `tel:${digits}`, wa: `https://wa.me/${wa}` };
}

// "just now", "5 min ago", "3 hr ago", "2 days ago", or a date.
export function ago(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return '';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const days = Math.round(hr / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function todayLabel() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
