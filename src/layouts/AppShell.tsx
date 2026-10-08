import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAutomationTicker } from '@/store';
import { Toaster } from '@/components';
import { ThemeSync } from '@/theme/ThemeSync';
import { ChatPanel } from '@/features/chat/ChatPanel';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { NotificationPanel } from './NotificationPanel';

const AUTOMATION_INTERVAL_MS = 60_000;

/** Sidebar + top bar + routed content. Mounts the global panels, toasts and theme sync. */
export function AppShell() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const closeNav = useCallback(() => setNavOpen(false), []);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Simulated background jobs (P1 escalations, review reminders): runs runAutomations()
  // on mount, every 60 s and whenever the demo clock moves. Idempotent.
  useAutomationTicker(AUTOMATION_INTERVAL_MS);

  return (
    <div className="min-h-screen bg-bg">
      <ThemeSync />
      <a
        href="#main"
        className="focus-ring sr-only z-[100] rounded-xl bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-lift focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <Sidebar open={navOpen} onClose={closeNav} />

      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopBar
          onOpenNav={() => setNavOpen(true)}
          onOpenNotifications={() => setNotificationsOpen(true)}
          onOpenChat={() => setChatOpen(true)}
        />
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 outline-none sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1360px]">
            {/* Keyed by path so each page remounts (skeleton + fade-in on every navigation). */}
            <div key={pathname}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      <NotificationPanel open={notificationsOpen} onClose={closeNotifications} />
      <ChatPanel open={chatOpen} onClose={closeChat} />
      <Toaster />
    </div>
  );
}

export default AppShell;
