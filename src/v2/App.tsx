import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, LayoutDashboard, MessageCircle, Moon, RotateCcw, Settings, Sun, Users } from 'lucide-react';
import { Toaster, toast } from '@/components';
import { PEOPLE, PERSONAS, type Role } from './data';
import { push, useStore } from './store';
import { Avatar, Btn, Card, cx, ago } from './ui';
import Dashboard from './pages/Dashboard';
import Assign from './pages/Assign';
import People from './pages/People';
import Chat from './pages/Chat';
import { ProjectSetup } from './pages/ProjectSetup';

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
              onClick={() => { readNotice(n.id); nav('/'); }}
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
  const [dark, setDark] = useState(() => { try { return localStorage.getItem('ls-theme') === 'dark'; } catch { return false; } });
  const [chatOpen, setChatOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const chatUnread = notices.filter((n) => n.to === me && !n.read && n.text.includes('anonymous')).length;
  const nav = useNavigate();
  useLiveNotices();
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try { localStorage.setItem('ls-theme', dark ? 'dark' : 'light'); } catch { /* storage unavailable */ }
  }, [dark]);

  const rail = [
    { to: '/activity', label: 'Activity', icon: Bell, badge: unread },
    ...NAV[person.role].map((n) => ({ ...n, badge: 0 })),
  ];

  return (
    <div className="flex min-h-screen bg-bg">
      <nav className="sticky top-0 flex h-screen w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <img src="./logo.jpg" alt="Lead Strategus" className="mb-3 h-11 w-11 rounded-xl bg-white object-contain p-0.5" />
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
          {person.role !== 'resource' && <button aria-label="Onboard a new project" title="Onboard a new project" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setSetupOpen(true)}><Settings size={18} /></button>}
          <button aria-label="Toggle dark mode" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setDark((d) => !d)}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button aria-label="Reset demo data" title="Reset demo data" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => { reset(); toast({ title: 'Demo data reset', tone: 'info' }); }}><RotateCcw size={18} /></button>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-6 py-3 backdrop-blur">
          <div className="flex items-center gap-2"><p className="text-sm font-extrabold tracking-tight">Lead Strategus</p><span className="hidden text-xs text-muted sm:inline">Tracker</span></div>
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
            {person.role !== 'resource' && <Route path="/assign" element={<Assign key={me} />} />}
            {(person.role === 'manager' || person.role === 'founder') && <Route path="/people" element={<People />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {/* Floating chat: stays on screen across pages, minimise with – */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="h-[min(520px,75vh)] w-[min(640px,calc(100vw-2.5rem))] overflow-hidden rounded-card border border-line shadow-lift">
            <Chat onClose={() => setChatOpen(false)} />
          </div>
        )}
        <button
          aria-label={chatOpen ? 'Minimise chat' : 'Open anonymous chat'}
          onClick={() => { setChatOpen((v) => !v); notices.filter((n) => n.to === me && !n.read && n.text.includes('anonymous')).forEach((n) => useStore.getState().readNotice(n.id)); }}
          className="focus-ring relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-on shadow-lift transition hover:scale-105"
        >
          <MessageCircle size={24} />
          {chatUnread > 0 && !chatOpen && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-coral-strong px-1.5 text-[10px] font-bold text-white">{chatUnread}</span>}
        </button>
      </div>
      <ProjectSetup open={setupOpen} onClose={() => setSetupOpen(false)} />
      <Toaster />
    </div>
  );
}

/** Catches render errors so one broken view never blanks the whole app. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <Card className="max-w-md text-center">
          <p className="text-lg font-bold">Something went wrong</p>
          <p className="mt-1 text-sm text-muted">{this.state.error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <Btn onClick={() => this.setState({ error: null })}>Try again</Btn>
            <Btn tone="ghost" className="border border-line" onClick={() => { try { localStorage.removeItem('ls-tracker-v2'); } catch { /* ignore */ } location.reload(); }}>Reset demo data</Btn>
          </div>
        </Card>
      </div>
    );
  }
}

export default function App() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, []);
  return (
    <ErrorBoundary>
      <HashRouter>
        <Shell />
      </HashRouter>
    </ErrorBoundary>
  );
}
