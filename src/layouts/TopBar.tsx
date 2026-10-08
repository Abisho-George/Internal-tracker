import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CalendarDays, Menu, MessageCircle, Moon, Sun, VenetianMask } from 'lucide-react';
import { useApp, useNow, usePrefs, useUnreadCount } from '@/store';
import { IconButton, Tooltip } from '@/components';
import { DemoClockMenu } from './DemoClockMenu';
import { ViewingAsMenu } from './ViewingAsMenu';

export interface TopBarProps {
  onOpenNav: () => void;
  onOpenNotifications: () => void;
  onOpenChat: () => void;
}

const ROUND_BTN =
  'focus-ring relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted transition duration-150 hover:bg-surface-2 hover:text-ink active:scale-95';

function ThemeToggle() {
  const { theme } = usePrefs();
  const toggleTheme = useApp((s) => s.toggleTheme);
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <Tooltip content={label} side="bottom" describe={false}>
      <button type="button" aria-label={label} onClick={toggleTheme} className={ROUND_BTN}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            {dark ? <Moon className="h-[18px] w-[18px]" aria-hidden /> : <Sun className="h-[18px] w-[18px]" aria-hidden />}
          </motion.span>
        </AnimatePresence>
      </button>
    </Tooltip>
  );
}

function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip content="Anonymous lounge" side="bottom" describe={false}>
      <button type="button" aria-label="Anonymous lounge" onClick={onClick} className={ROUND_BTN}>
        <MessageCircle className="h-[18px] w-[18px]" aria-hidden />
        <span
          aria-hidden
          className="absolute bottom-1 right-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-lavender-soft text-lavender-ink ring-2 ring-bg"
        >
          <VenetianMask className="h-2.5 w-2.5" strokeWidth={2.5} />
        </span>
      </button>
    </Tooltip>
  );
}

/** Sticky top bar: demo date + clock, viewing-as switcher, chat, notifications, theme. */
export function TopBar({ onOpenNav, onOpenNotifications, onOpenChat }: TopBarProps) {
  const now = useNow(30_000);
  const unread = useUnreadCount();

  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <IconButton label="Open menu" icon={Menu} onClick={onOpenNav} className="-ml-1 lg:hidden" />

        <div className="flex min-w-0 items-center gap-2">
          <p className="hidden items-center gap-2 whitespace-nowrap text-sm font-semibold text-ink sm:inline-flex">
            <CalendarDays className="h-4 w-4 text-faint" aria-hidden />
            <span>{format(now, 'EEE, d MMM')}</span>
            <span className="sr-only">(today in the demo)</span>
          </p>
          <DemoClockMenu />
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ViewingAsMenu />
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-line sm:block" />
          <ChatButton onClick={onOpenChat} />
          <IconButton label="Notifications" icon={Bell} badge={unread} onClick={onOpenNotifications} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
