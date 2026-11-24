import { STATUSES } from './domain.js';

function text(value, label, max) {
  if (value == null) return { value: null };
  const trimmed = String(value).trim();
  if (!trimmed) return { value: null };
  if (trimmed.length > max) return { error: `${label} must be ${max} characters or fewer.` };
  return { value: trimmed };
}

function money(value, label) {
  if (value === '' || value == null) return { value: null };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return { error: `${label} must be zero or a positive amount.` };
  }
  return { value: Math.round(number * 100) / 100 };
}

export function validateProject(body) {
  const client = text(body.clientName, 'Client', 200);
  if (client.error) return client;
  if (!client.value) return { error: 'Client name is required.' };

  const lead = text(body.leadBy, 'Lead', 120);
  if (lead.error) return lead;
  const serverName = text(body.serverName, 'Server name', 200);
  if (serverName.error) return serverName;
  const serverOs = text(body.serverOs, 'Server OS', 120);
  if (serverOs.error) return serverOs;
  const ip = text(body.ip, 'IP', 120);
  if (ip.error) return ip;
  const username = text(body.serverUsername, 'Username', 200);
  if (username.error) return username;
  const url = text(body.url, 'URL', 1000);
  if (url.error) return url;
  const notes = text(body.notes, 'Notes', 5000);
  if (notes.error) return notes;

  const status = text(body.status, 'Status', 40).value || 'Under Discussion';
  if (!STATUSES.includes(status)) {
    return { error: 'Status must be Live, Under Development, or Under Discussion.' };
  }

  const payment = money(body.payment, 'Payment');
  if (payment.error) return payment;
  const balance = money(body.balance, 'Balance');
  if (balance.error) return balance;
  const monthlyServerCost = money(body.monthlyServerCost, 'Monthly server cost');
  if (monthlyServerCost.error) return monthlyServerCost;

  let serverDueDay = null;
  if (body.serverDueDay !== '' && body.serverDueDay != null) {
    const day = Number(body.serverDueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return { error: 'Server due day must be a day of the month, from 1 to 31.' };
    }
    serverDueDay = day;
  }

  let serverPassword;
  if (typeof body.serverPassword === 'string' && body.serverPassword.length) {
    if (body.serverPassword.length > 8000) return { error: 'Password is too long.' };
    serverPassword = body.serverPassword;
  }

  return {
    value: {
      clientName: client.value,
      leadBy: lead.value,
      serverName: serverName.value,
      serverOs: serverOs.value,
      status,
      payment: payment.value,
      balance: balance.value,
      monthlyServerCost: monthlyServerCost.value,
      ip: ip.value,
      serverUsername: username.value,
      serverPassword,
      clearPassword: Boolean(body.clearPassword),
      serverDueDay,
      url: url.value,
      notes: notes.value,
    },
  };
}
