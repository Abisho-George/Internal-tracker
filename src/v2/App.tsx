import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Bell, ClipboardList, FolderKanban, LayoutDashboard, MessageCircle, RotateCcw, NotebookPen, Palette, Settings, UserCircle, Users } from 'lucide-react';
import { Toaster, toast } from '@/components';
import { canManage, isLeadRole, PEOPLE, PERSONAS } from './data';
import { nameOf, push, useStore } from './store';
import { FunLayer, Mascot, ThemeApplier, ThemeMenu } from './theme';
import { Avatar, Btn, Card, cx } from './ui';
import { LeadDashboard, TeamDashboard } from './pages/Dashboard';
import Projects from './pages/Projects';
import LeadProjects from './pages/LeadProjects';
import Profile from './pages/Profile';
import DailyUpdate from './pages/DailyUpdate';
import TeamDaily from './pages/TeamDaily';
import Assign from './pages/Assign';
import People from './pages/People';
import Chat from './pages/Chat';
import { ProjectSetup } from './pages/ProjectSetup';

type NavItem = { to: string; label: string; icon: typeof Bell };
const DASH: NavItem = { to: '/', label: 'Dashboard', icon: LayoutDashboard };
const PROJECTS: NavItem = { to: '/projects', label: 'Projects', icon: FolderKanban };
const ASSIGN: NavItem = { to: '/assign', label: 'Assign', icon: ClipboardList };
const PEOPLE_NAV: NavItem = { to: '/people', label: 'People', icon: Users };
const PROFILE: NavItem = { to: '/profile', label: 'Profile', icon: UserCircle };


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
  const { me, notices, projects, setMe, reset } = useStore();
  const person = PEOPLE.find((p) => p.id === me)!;
  const [chatOpen, setChatOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const chatUnread = notices.filter((n) => n.to === me && !n.read && n.text.includes('anonymous')).length;
  const nav = useNavigate();
  useLiveNotices();
  const [themeOpen, setThemeOpen] = useState(false);

  const lead = isLeadRole(person.role);
  // Resources and PMs share one view; Assign appears once they own or help run (admin) an approved project.
  const ownsProject = projects.some((p) => canManage(p, me) && p.status === 'active');
  const navItems: NavItem[] = [...(lead ? [DASH, PROJECTS, ASSIGN, PEOPLE_NAV] : ownsProject ? [DASH, PROJECTS, ASSIGN] : [DASH, PROJECTS]), PROFILE];
  const rail = [
    { to: '/daily', label: 'Tasks update', icon: NotebookPen, badge: 0 },
    ...navItems.map((n) => ({ ...n, badge: 0 })),
  ];

  return (
    <div className="relative flex min-h-screen bg-bg">
      <ThemeApplier />
      <FunLayer />
      <nav className="sticky top-0 z-10 flex h-screen w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
        <img src="./logo.jpg" alt="Lead Strategus" className="mb-3 h-11 w-11 rounded-xl bg-white object-contain p-0.5" />
        {rail.map((r) => (
          <NavLink
            key={r.to}
            to={r.to}
            end
            className={({ isActive }) => cx('focus-ring relative flex w-16 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center text-[11px] font-semibold leading-tight', isActive ? 'bg-accent-soft text-accent-ink' : 'text-muted hover:bg-surface-2')}
          >
            <r.icon size={20} className="shrink-0" />
            <span className="block w-full text-center">{r.label}</span>
            {r.badge > 0 && <span className="absolute right-2 top-1 rounded-full bg-coral-strong px-1.5 text-[10px] font-bold text-white">{r.badge}</span>}
          </NavLink>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2">
          {lead && <button aria-label="Onboard a new project" title="Onboard a new project" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setSetupOpen(true)}><Settings size={18} /></button>}
          <button aria-label="Theme" title="Theme" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => setThemeOpen(true)}><Palette size={18} /></button>
          <button aria-label="Reset demo data" title="Reset demo data" className="focus-ring rounded-xl p-2 text-muted hover:bg-surface-2" onClick={() => { reset(); toast({ title: 'Demo data reset', tone: 'info' }); }}><RotateCcw size={18} /></button>
        </div>
      </nav>

      <div className="relative z-[1] min-w-0 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2"><p className="text-sm font-extrabold tracking-tight">Lead Strategus</p><span className="hidden text-xs text-muted sm:inline">Tracker</span></div>
          <label className="flex min-w-0 items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-2 text-xs">
            <Avatar id={me} size="sm" />
            <span className="hidden text-muted sm:inline">Viewing as</span>
            <select aria-label="Viewing as" className="focus-ring min-w-0 max-w-[11rem] rounded-full bg-surface px-2 py-1 font-semibold sm:max-w-none" value={me} onChange={(e) => { setMe(e.target.value); nav('/'); }}>
              {(['pm', 'resource', 'manager', 'founder'] as const).map((r) => (
                <optgroup key={r} label={r === 'pm' ? 'Project managers' : r === 'resource' ? 'Resources' : r === 'manager' ? 'Manager' : 'Founders'}>
                  {PERSONAS.filter((id) => PEOPLE.find((x) => x.id === id)?.role === r).map((id) => (
                    <option key={id} value={id}>{nameOf(id)} · {PEOPLE.find((x) => x.id === id)?.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6">
          <Routes>
            <Route path="/" element={lead ? <LeadDashboard /> : <TeamDashboard />} />
            <Route path="/projects" element={lead ? <LeadProjects /> : <Projects />} />
            <Route path="/daily" element={lead ? <TeamDaily /> : <DailyUpdate />} />
            <Route path="/profile" element={<Profile />} />
            {(lead || ownsProject) && <Route path="/assign" element={<Assign key={me} />} />}
            {lead && <Route path="/people" element={<People />} />}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
      {/* Floating chat: stays on screen across pages, minimise with the minus button */}
      <div className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-3">
        {chatOpen && <div aria-hidden className="fixed inset-0 -z-10" onClick={() => setChatOpen(false)} />}
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
      <ThemeMenu open={themeOpen} onClose={() => setThemeOpen(false)} />
      <Mascot />
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
