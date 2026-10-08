import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, differenceInMinutes, format, parseISO } from 'date-fns';
import {
  BellRing,
  CalendarCheck,
  CheckCheck,
  CircleCheck,
  ClipboardCheck,
  Clock,
  Info,
  Mail,
  MessageSquareHeart,
  Sparkles,
  Sprout,
  type LucideIcon,
} from 'lucide-react';
import { useApp, useCurrentUser, useNow } from '@/store';
import type { AppNotification, NotificationType, PastelKey } from '@/store/types';
import { Button, Chip, EmptyState, SlideOver, TONE_SOFT, cn } from '@/components';

export interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_STYLE: Record<NotificationType, { icon: LucideIcon; tone: PastelKey }> = {
  p1Escalation: { icon: BellRing, tone: 'peach' },
  reviewRequested: { icon: ClipboardCheck, tone: 'sky' },
  reviewReminder: { icon: Clock, tone: 'butter' },
  reviewApproved: { icon: CircleCheck, tone: 'mint' },
  reviewSentBack: { icon: Sprout, tone: 'butter' },
  feedbackSent: { icon: MessageSquareHeart, tone: 'lavender' },
  spotlightPublished: { icon: Sparkles, tone: 'lavender' },
  planReady: { icon: CalendarCheck, tone: 'sky' },
  dependencyCleared: { icon: CheckCheck, tone: 'mint' },
  system: { icon: Info, tone: 'grey' },
};

/** "Just now", "12m ago", "3h ago", "Yesterday, 4:10 pm", "Mon 5 Oct" — on the demo clock. */
export function relativeTime(iso: string, now: Date): string {
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = differenceInMinutes(now, d);
  const days = differenceInCalendarDays(now, d);
  if (mins < 1) return 'Just now';
  if (days === 0) return mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
  if (days === 1) return `Yesterday, ${format(d, 'h:mm aaa')}`;
  return format(d, 'EEE d MMM');
}

function NotificationRow({ n, now, onOpen }: { n: AppNotification; now: Date; onOpen: (n: AppNotification) => void }) {
  const isEmail = n.channel === 'email';
  const style = TYPE_STYLE[n.type] ?? TYPE_STYLE.system;
  const Icon = isEmail ? Mail : style.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          'focus-ring group flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors hover:bg-surface-2',
          !n.read && 'bg-accent-soft/40',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
            TONE_SOFT[isEmail ? 'sky' : style.tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm leading-snug', n.read ? 'text-muted' : 'font-semibold text-ink')}>
            {n.text}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-faint">
            <span>{relativeTime(n.createdAt, now)}</span>
            {isEmail && (
              <Chip size="sm" tone="sky" icon={Mail}>
                Email sent
              </Chip>
            )}
          </span>
        </span>
        {!n.read && (
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </button>
    </li>
  );
}

/** Slide-over listing the current viewer's notifications, newest first. */
export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const me = useCurrentUser();
  const now = useNow(30_000);
  const all = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markNotificationRead);
  const markAllRead = useApp((s) => s.markAllNotificationsRead);
  const navigate = useNavigate();

  const { unread, earlier } = useMemo(() => {
    const mine = all
      .filter((n) => n.toPersonId === me.id)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    return { unread: mine.filter((n) => !n.read), earlier: mine.filter((n) => n.read) };
  }, [all, me.id]);

  const openNotification = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.link) {
      onClose();
      navigate(n.link);
    }
  };

  const empty = unread.length === 0 && earlier.length === 0;

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title="Notifications"
      description={unread.length > 0 ? `${unread.length} new for ${me.firstName}` : `Updates for ${me.firstName}`}
      actions={
        <Button
          variant="ghost"
          size="sm"
          icon={CheckCheck}
          disabled={unread.length === 0}
          onClick={() => markAllRead(me.id)}
        >
          Mark all as read
        </Button>
      }
    >
      {empty ? (
        <EmptyState emoji="☀️" title="All caught up ☀️" description="New updates will show up here." />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="notif-new">
            <h3 id="notif-new" className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-faint">
              New
            </h3>
            {unread.length > 0 ? (
              <ul className="space-y-1">
                {unread.map((n) => (
                  <NotificationRow key={n.id} n={n} now={now} onOpen={openNotification} />
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-mint-soft px-3 py-2.5 text-sm font-medium text-mint-ink">All caught up ☀️</p>
            )}
          </section>
          {earlier.length > 0 && (
            <section aria-labelledby="notif-earlier">
              <h3
                id="notif-earlier"
                className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-faint"
              >
                Earlier
              </h3>
              <ul className="space-y-1">
                {earlier.map((n) => (
                  <NotificationRow key={n.id} n={n} now={now} onOpen={openNotification} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </SlideOver>
  );
}
