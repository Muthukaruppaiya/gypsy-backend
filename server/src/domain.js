import { decrypt } from './crypto.js';
import { nextDue, prettyDate } from './due.js';

export const STATUSES = ['Live', 'Under Development', 'Under Discussion'];

function inr(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function toProject(row, includePassword = false) {
  const payment = row.payment == null ? null : Number(row.payment);
  const collected = row.collected == null ? 0 : Number(row.collected);
  const due = nextDue(row.server_due_day);
  const project = {
    id: Number(row.id),
    clientName: row.client_name,
    leadBy: row.lead_by,
    serverName: row.server_name,
    serverOs: row.server_os,
    status: row.status,
    payment,
    balance: payment == null ? null : Math.max(payment - collected, 0),
    received: payment == null && collected === 0 ? null : collected,
    ip: row.ip,
    serverUsername: row.server_username,
    hasPassword: Boolean(row.server_password),
    serverDueDay: row.server_due_day == null ? null : Number(row.server_due_day),
    nextDueDate: due?.date ?? null,
    daysUntilDue: due?.days ?? null,
    url: row.url,
    notes: row.notes,
    monthlyServerCost: row.monthly_server_cost == null ? null : Number(row.monthly_server_cost),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (includePassword) project.serverPassword = decrypt(row.server_password);
  return project;
}

const SERVER_FIELDS = [
  'serverName', 'serverOs', 'ip', 'serverUsername', 'hasPassword', 'serverPassword',
  'serverDueDay', 'nextDueDate', 'daysUntilDue', 'monthlyServerCost',
];

// What a sales login may see of a project: no server, login, or hosting details.
export function forRole(project, role) {
  if (role === 'admin' || !project) return project;
  const copy = { ...project };
  for (const key of SERVER_FIELDS) delete copy[key];
  return copy;
}

export function hasHostedServer(project) {
  if (!project || project.status === 'Under Discussion') return false;
  const name = String(project.serverName || '').trim();
  if (/local/i.test(name)) return false;
  if (name && !/^nil\b/i.test(name)) return true;
  return Boolean(
    project.serverOs
    || project.ip
    || project.serverUsername
    || project.serverDueDay
    || project.monthlyServerCost
  );
}

function missingBits(project) {
  const local = /local/i.test(project.serverName || '');
  const bits = [];
  if (!project.serverName) bits.push('server');
  if (!local && !project.ip) bits.push('IP');
  if (!local && !project.serverUsername) bits.push('username');
  if (!local && !project.url) bits.push('URL');
  return bits;
}

function buildDigest({ renewals, unpaid, gaps, todayLabel }) {
  const lines = [`Gypsy Desk · ${todayLabel}`, ''];

  lines.push('Server renewals');
  if (!renewals.length) lines.push('- None recorded');
  for (const project of renewals) {
    const when = project.daysUntilDue === 0
      ? 'due today'
      : project.daysUntilDue === 1
        ? 'tomorrow'
        : `in ${project.daysUntilDue} days`;
    lines.push(`- ${project.clientName} · ${prettyDate(project.nextDueDate)} · ${when}${project.url ? ` · ${project.url}` : ''}`);
  }

  lines.push('', 'Unpaid balances');
  if (!unpaid.length) lines.push('- Nothing open');
  for (const project of unpaid) {
    lines.push(`- ${project.clientName} · ${inr(project.balance)}${project.leadBy ? ` · ${project.leadBy}` : ''}`);
  }

  lines.push('', 'Missing server details');
  if (!gaps.length) lines.push('- Live and in-build records look complete');
  for (const project of gaps) {
    lines.push(`- ${project.clientName} · ${project.missing.join(', ')}`);
  }

  return lines.join('\n');
}

export function buildOverview(projects) {
  const counts = {
    total: projects.length,
    live: projects.filter((project) => project.status === 'Live').length,
    underDevelopment: projects.filter((project) => project.status === 'Under Development').length,
    underDiscussion: projects.filter((project) => project.status === 'Under Discussion').length,
  };

  const money = projects.reduce((acc, project) => {
    if (project.payment != null) acc.contracted += project.payment;
    if (project.balance != null) acc.outstanding += project.balance;
    if (project.received != null) acc.collected += project.received;
    return acc;
  }, { contracted: 0, collected: 0, outstanding: 0 });

  const renewals = projects
    .filter((project) => project.serverDueDay && hasHostedServer(project))
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const unpaid = projects
    .filter((project) => (project.balance || 0) > 0)
    .sort((a, b) => b.balance - a.balance);

  const gaps = projects
    .filter((project) => project.status === 'Live' || project.status === 'Under Development')
    .map((project) => ({ ...project, missing: missingBits(project) }))
    .filter((project) => project.missing.length);

  const leadMap = new Map();
  for (const project of projects) {
    const key = project.leadBy || 'Unassigned';
    if (!leadMap.has(key)) leadMap.set(key, { lead: key, projects: 0, outstanding: 0 });
    const row = leadMap.get(key);
    row.projects += 1;
    row.outstanding += project.balance || 0;
  }

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return {
    counts,
    money,
    renewals,
    unpaid,
    gaps,
    leads: [...leadMap.values()].sort((a, b) => b.projects - a.projects),
    digest: buildDigest({ renewals, unpaid, gaps, todayLabel }),
    todayLabel,
  };
}
