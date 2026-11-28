export async function api(path, { method = 'GET', body } = {}) {
  const token = localStorage.getItem('token');
  let response;
  try {
    response = await fetch(path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach the desk. Check your connection and that the server is running.');
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  const publicAuth = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
  if (response.status === 401 && !publicAuth) {
    localStorage.removeItem('token');
    const onAuthPage = window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/register');
    if (!onAuthPage) {
      const next = window.location.pathname + window.location.search;
      window.location.assign(`/login?next=${encodeURIComponent(next)}`);
    }
  }

  if (response.status === 403) window.dispatchEvent(new Event('gypsy-auth-refresh'));
  if (!response.ok) {
    const fallback = response.status >= 500
      ? 'The server had a problem. Try again in a moment.'
      : 'Request failed.';
    throw new Error(data?.error || fallback);
  }
  return data;
}

export async function downloadCsv() {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/projects/export.csv', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Could not export the sheet.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'project-details.csv';
  link.click();
  URL.revokeObjectURL(url);
}
