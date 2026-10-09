import { useEffect, useRef, useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, LayoutDashboard, MessageCircle, Moon, RotateCcw, Sun, Users } from 'lucide-react';
import { Toaster, toast } from '@/components';
import { PEOPLE, PERSONAS, type Role } from './data';
import { push, useStore } from './store';
import { Avatar, Btn, Card, cx, ago } from './ui';
import Dashboard from './pages/Dashboard';
import Assign from './pages/Assign';
import People from './pages/People';
import Chat from './pages/Chat';

const NAV: Record<Role, { to: string; label: string; icon: typeof Bell }[]> = {
  resource: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard }],
  pm: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assign', label: 'Assign', icon: ClipboardList },
  ],
  manager: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assign', label: 'Assign', icon: ClipboardList },
    { to: '/people', label: 'People', icon: Users },
  ],
  founder: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/assign', label: 'Assign', icon: ClipboardList },
    { to: '/people', label: 'People', icon: Users },
  ],
};

function Activity() {
  const { me, notices, readAll, readNotice } = useStore();
  const mine = notices.filter((n) => n.to === me);
  const nav = useNavigate();
  return (
    <Card className="mx-auto max-w-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-bold">Activity</h1>
        <Btn tone="ghost" onClick={readAll}>Mark all read</Btn>
      </div>
      {mine.length === 0 && <p className="py-8 text-center text-muted">All caught up ☀️</p>}
      <ul className="divide-y divide-line">
        {mine.map((n) => (
          <li key={n.id}>
            <button
              className={cx('focus-ring flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-surface-2', !n.read && 'bg-accent-soft/50')}
              onClick={() => { readNotice(n.id); nav(n.text.includes('anonymous') ? '/chat' : '/'); }}
            >
              <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-accent')} />
              <span className="flex-1 text-sm">{n.text}<span className="block text-xs text-muted">{ago(n.at)}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Pops a Teams-style toast (and a browser notification when allowed) for each new notice to the viewer. */
function useLiveNotices() {
  const { me, notices } = useStore();
  const seen = useRef<Set<string>>(new Set());
  const forMe = useRef<string | null>(null);
  useEffect(() => {
    const mine = notices.filter((n) => n.to === me);
    if (forMe.current !== me) {
      // Switching person: treat what's already there as seen; only new events pop up.
      forMe.current = me;
      seen.current = new Set(mine.map((n) => n.id));
      return;
    }
    mine.filter((n) => !seen.current.has(n.id)).forEach((n) => {
      seen.current.add(n.id);
      if (!n.read) {
        toast({ title: n.text, tone: 'info', emoji: '🔔' });
        push(n.text);
      }
    });
  }, [notices, me]);
}

function Shell() {
  const { me, notices, setMe, reset } = useStore();
  const person = PEOPLE.find((p) => p.id === me)!;
  const unread = notices.filter((n) => n.to === me && !n.read).length;
  const [dark, setDark] = useState(() => localStorage.getItem('ls-theme') === 'dark');
  const nav = useNavigate();
  useLiveNotices();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('ls-theme', dark ? 'dark' : 'light');
  }, [dark]);

  const rail = [
    { to: '/activity', label: 'Activity', icon: Bell, badge: unread },
    { to: '/chat', label: 'Chat', icon: MessageCircle, badge: 0 },
    ...NAV[person.role].map((n) => ({ ...n, badge: 0 })),
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      <nav className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-extrabold text-accent-on">LS</div>
        {rail.map((r) => (
          <NavLink
            key={r.to}
            to={r.to}
            end
            className={({ isActive }) => cx('focus-ring relative flex w-16 flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold', isActive ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-surface-2')}
          >
            <r.icon size={20} />
            {r.label}
            {r.badge > 0 && <span className="absolute right-2 top-1 rounded-full bg-coral-strong px-1.5 text-[10px] font-bold text-white">{r.badge}</span>}
          </NavLink>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          <button aria-label="Toggle dark mode" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setDark((d) => !d)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button aria-label="Reset demo data" title="Reset demo data" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => { reset(); toast({ title: 'Demo data reset', tone: 'info' }); }}><RotateCcw size={18} /></button>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-6 py-3 backdrop-blur">
          <p className="text-sm font-bold">LS Tracker</p>
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1" role="group" aria-label="Viewing as">
            <span className="px-2 text-xs text-muted">Viewing as</span>
            {PERSONAS.map((id) => {
              const p = PEOPLE.find((x) => x.id === id)!;
              return (
                <button
                  key={id}
                  onClick={() => { setMe(id); nav('/'); }}
                  className={cx('focus-ring flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-semibold', id === me ? 'bg-surface shadow-soft' : 'text-muted')}
                >
                  <Avatar id={id} size="sm" /> {p.name.split(' ')[0]} <span className="hidden font-normal sm:inline">· {p.title}</span>
                </button>
              );
            })}
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/chat" element={<Chat />} />
            {person.role !== 'resource' && <Route path="/assign" element={<Assign key={me} />} />}
            {(person.role === 'manager' || person.role === 'founder') && <Route path="/people" element={<People />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, []);
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
