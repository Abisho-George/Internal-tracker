import { useEffect, useRef } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useApp, useCurrentUser } from '@/store';
import { ComingSoon, IconButton, cn, useFocusTrap } from '@/components';
import { COMING_SOON_ITEMS, NAV, ROLE_HOME, type NavItem } from './nav';

export interface SidebarProps {
  /** Mobile drawer state (below lg). On desktop the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
}

/** Pastel "LS" mark + wordmark. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <span
        aria-hidden
        className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-lavender-strong via-sky-strong to-mint-strong text-[13px] font-extrabold tracking-tight text-surface shadow-soft"
      >
        LS
        <span className="absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full bg-butter-strong/90" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-extrabold tracking-tight text-ink">LS Tracker</span>
        <span className="mt-1 text-[11px] font-medium text-faint">Lead Strategus</span>
      </span>
    </span>
  );
}

function usePendingReviewCount(): number {
  return useApp(
    (s) => s.reviewTasks.filter((r) => r.reviewerId === s.currentUserId && r.status === 'pending').length,
  );
}

function NavRow({ item, badge, layoutKey }: { item: NavItem; badge?: number; layoutKey: string }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'focus-ring group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
          isActive
            ? 'bg-accent-soft font-semibold text-accent-ink'
            : 'font-medium text-muted hover:bg-surface-2 hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId={`${layoutKey}-active`}
              aria-hidden
              className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {!!badge && badge > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-accent-on">
              {badge}
              <span className="sr-only"> pending</span>
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate, layoutKey }: { onNavigate?: () => void; layoutKey: string }) {
  const me = useCurrentUser();
  const pendingReviews = usePendingReviewCount();
  const items = NAV[me.role];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-4 pt-5">
        <Link to={ROLE_HOME[me.role]} onClick={onNavigate} className="focus-ring -m-1 inline-flex rounded-xl p-1">
          <Logo />
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-1" onClick={onNavigate}>
          {items.map((item) => (
            <li key={item.to}>
              <NavRow
                item={item}
                layoutKey={layoutKey}
                badge={item.badge === 'pendingReviews' ? pendingReviews : undefined}
              />
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-faint">On the way</p>
          <ul className="space-y-1">
            {COMING_SOON_ITEMS.map(({ label, icon: Icon }) => (
              <li key={label}>
                <span
                  aria-disabled="true"
                  title={`${label} — coming soon`}
                  className="flex cursor-not-allowed select-none items-start gap-3 rounded-xl px-3 py-2 text-sm font-medium text-faint opacity-75"
                >
                  <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 leading-relaxed">
                    {label} <ComingSoon className="ml-0.5 align-[1px]" />
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line/70 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-faint">Clickable prototype · demo data only</p>
      </div>
    </div>
  );
}

/** Role-based sidebar. Fixed on desktop; an off-canvas drawer below lg. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, drawerRef, onClose);

  // Close the drawer if the viewport grows to desktop size.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => mq.matches && onClose();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [open, onClose]);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line/70 bg-surface/80 backdrop-blur-md lg:block">
        <SidebarContent layoutKey="sidebar-desktop" />
      </aside>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              aria-hidden
              className="absolute inset-0 bg-ink/25 backdrop-blur-[2px] dark:bg-bg/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            <motion.div
              ref={drawerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              tabIndex={-1}
              className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line/70 bg-surface shadow-lift outline-none"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <div className="absolute right-3 top-4 z-10">
                <IconButton label="Close menu" icon={X} size="sm" onClick={onClose} showTooltip={false} />
              </div>
              <SidebarContent onNavigate={onClose} layoutKey="sidebar-drawer" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
