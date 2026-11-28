import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Icon } from './ui';

// Jump anywhere: pages, projects, and leads. Opens with Ctrl+K, Cmd+K, or "/".
export default function QuickSearch({ open, onClose, isAdmin }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    setLoading(true);
    Promise.all([
      api('/api/projects').then(setProjects).catch(() => {}),
      api('/api/leads').then((data) => setLeads(data.leads || [])).catch(() => {}),
    ]).finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const pages = useMemo(() => [
    { label: 'Desk', to: '/', icon: 'desk' },
    { label: 'Log a call', to: '/leads/new', icon: 'phone' },
    { label: 'Follow-ups · Due now', to: '/leads/due', icon: 'leads' },
    { label: 'Follow-ups · Later', to: '/leads/later', icon: 'leads' },
    { label: 'Projects', to: '/projects', icon: 'projects' },
    { label: 'New project', to: '/projects/new', icon: 'plus' },
    ...(isAdmin ? [
      { label: 'Payments', to: '/payments', icon: 'payments' },
      { label: 'Server log', to: '/servers', icon: 'servers' },
      { label: 'Timeline', to: '/timeline', icon: 'timeline' },
      { label: 'Automation', to: '/automation', icon: 'auto' },
      { label: 'Team', to: '/team', icon: 'team' },
    ] : []),
    { label: 'Account', to: '/account', icon: 'account' },
  ], [isAdmin]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const match = (...parts) => !term || parts.filter(Boolean).join(' ').toLowerCase().includes(term);
    const out = [];
    for (const page of pages) {
      if (match(page.label)) out.push({ ...page, group: 'Go to', sub: '' });
    }
    for (const project of projects) {
      if (match(project.clientName, project.leadBy, project.url, project.serverName, project.ip)) {
        out.push({ label: project.clientName, sub: `${project.status}${project.leadBy ? ` · ${project.leadBy}` : ''}`, to: `/projects/${project.id}`, icon: 'projects', group: 'Projects' });
      }
    }
    for (const lead of leads) {
      if (lead.status === 'Converted') continue;
      if (match(lead.clientName, lead.phone, lead.note)) {
        out.push({ label: lead.clientName, sub: `${lead.status === 'Open' ? 'Open lead' : 'Closed lead'}${lead.phone ? ` · ${lead.phone}` : ''}`, to: lead.status === 'Open' ? `/leads/${lead.id}/edit` : '/leads/closed', icon: 'leads', group: 'Leads' });
      }
    }
    return term ? out.slice(0, 30) : out.filter((item) => item.group === 'Go to');
  }, [q, pages, projects, leads]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  if (!open) return null;

  function go(item) {
    if (!item) return;
    onClose();
    navigate(item.to);
  }

  function onKey(event) {
    if (event.key === 'Escape') onClose();
    else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[active]);
    }
  }

  let lastGroup = '';
  return (
    <div className="search-back" onMouseDown={onClose}>
      <div className="search-box" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={onKey}
            placeholder="Search projects, leads, or pages"
            aria-label="Search"
            role="combobox"
            aria-expanded="true"
            aria-controls="search-results"
          />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close search"><Icon name="close" /></button>
        </div>
        <ul className="search-results" id="search-results" role="listbox">
          {loading && q && <li className="search-note">Searching…</li>}
          {!loading && results.length === 0 && <li className="search-note">Nothing matches “{q}”.</li>}
          {results.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={`${item.group}-${item.to}-${index}`} role="presentation">
                {header && <p className="search-group">{header}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  className={`search-item${index === active ? ' on' : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => go(item)}
                >
                  <Icon name={item.icon} />
                  <span className="search-label">{item.label}</span>
                  {item.sub && <span className="search-sub">{item.sub}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="search-foot"><kbd>↑</kbd><kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close</p>
      </div>
    </div>
  );
}
